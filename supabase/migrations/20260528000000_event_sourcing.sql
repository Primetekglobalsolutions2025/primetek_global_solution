-- ============================================================
-- Primetek HR Portal: Event-Sourcing & Materialized Projections Schema
-- ============================================================

-- 1. Setup Custom Enum types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_event_type') THEN
        CREATE TYPE public.attendance_event_type AS ENUM (
            'CLOCK_IN',
            'BREAK_STARTED',
            'BREAK_ENDED',
            'HEARTBEAT_RECEIVED',
            'IDLE_DETECTED',
            'IDLE_WARNING_SHOWN',
            'AUTO_BREAK_TRIGGERED',
            'GPS_EXIT',
            'GPS_REENTRY',
            'GEOLOCATION_PERMISSION_REVOKED',
            'SESSION_RECOVERED',
            'CLOCK_OUT',
            'FORCE_LOGOUT',
            'ADMIN_OVERRIDE'
        );
    END IF;
END $$;

-- 2. Create partitioned Attendance Events Table
CREATE TABLE IF NOT EXISTS public.attendance_events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    event_type public.attendance_event_type NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence_number INT NOT NULL,
    idempotency_key VARCHAR(256) NOT NULL,
    
    -- Telemetry snapshots
    client_ip INET NOT NULL,
    gps_lat NUMERIC(10,6),
    gps_lng NUMERIC(10,6),
    gps_accuracy NUMERIC(6,2),
    device_fingerprint VARCHAR(256),
    
    -- Metadata
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    PRIMARY KEY (id, event_timestamp)
) PARTITION BY RANGE (event_timestamp);

-- Default partition to catch any dates without specific monthly partitions
CREATE TABLE IF NOT EXISTS public.attendance_events_default 
PARTITION OF public.attendance_events DEFAULT;

-- Indexes for event replay and idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_seq ON public.attendance_events(session_id, sequence_number, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_employee_session ON public.attendance_events(employee_id, session_id, event_timestamp DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_idempotency ON public.attendance_events(idempotency_key, event_timestamp);

-- 3. Create Projections Table (Materialized Read Model)
CREATE TABLE IF NOT EXISTS public.attendance_projections (
    session_id UUID PRIMARY KEY,
    employee_id UUID NOT NULL,
    current_state VARCHAR(32) NOT NULL DEFAULT 'OFFLINE',
    productive_seconds INT NOT NULL DEFAULT 0,
    break_seconds INT NOT NULL DEFAULT 0,
    confidence_score INT NOT NULL DEFAULT 100,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_geofence_status BOOLEAN NOT NULL DEFAULT true,
    is_stale BOOLEAN NOT NULL DEFAULT false,
    session_version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projections_employee ON public.attendance_projections(employee_id);
CREATE INDEX IF NOT EXISTS idx_projections_stale ON public.attendance_projections(is_stale) WHERE is_stale = true;

-- Enable Row Level Security
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_projections ENABLE ROW LEVEL SECURITY;

-- Policies for Attendance Events
CREATE POLICY "Employees can select own events" ON public.attendance_events 
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Service role manages events" ON public.attendance_events 
    FOR ALL USING (auth.role() = 'service_role');

-- Policies for Attendance Projections
CREATE POLICY "Employees can select own projections" ON public.attendance_projections 
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Service role manages projections" ON public.attendance_projections 
    FOR ALL USING (auth.role() = 'service_role');

-- 4. Create Immutable Audit Logs Table
CREATE TABLE IF NOT EXISTS public.immutable_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    employee_id UUID NOT NULL,
    session_id UUID NOT NULL,
    action_type VARCHAR(64) NOT NULL,
    confidence_score INT NOT NULL,
    telemetry_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    justification_chain JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.immutable_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own audits" ON public.immutable_audit_logs 
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Admins can view all audits" ON public.immutable_audit_logs 
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Service role manages audits" ON public.immutable_audit_logs 
    FOR ALL USING (auth.role() = 'service_role');

-- Function and trigger to prevent modification of immutable audit logs
CREATE OR REPLACE FUNCTION public.prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Immutable Audit logs cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_no_update ON public.immutable_audit_logs;
CREATE TRIGGER trg_audit_no_update
    BEFORE UPDATE ON public.immutable_audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_modification();

DROP TRIGGER IF EXISTS trg_audit_no_delete ON public.immutable_audit_logs;
CREATE TRIGGER trg_audit_no_delete
    BEFORE DELETE ON public.immutable_audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_modification();

-- 5. Create Dynamic Projection Trigger Function
CREATE OR REPLACE FUNCTION public.apply_event_to_projection()
RETURNS TRIGGER AS $$
DECLARE
    v_prod_delta INT := 0;
    v_break_delta INT := 0;
    v_last_time TIMESTAMPTZ;
    v_state_val VARCHAR;
BEGIN
    -- Fetch the last processed state and timestamp of the projection
    SELECT current_state, last_heartbeat_at 
    INTO v_state_val, v_last_time
    FROM public.attendance_projections
    WHERE session_id = NEW.session_id
    FOR UPDATE;

    -- If projection does not exist, initialize it (only on CLOCK_IN event)
    IF NOT FOUND THEN
        IF NEW.event_type = 'CLOCK_IN' THEN
            INSERT INTO public.attendance_projections (
                session_id, employee_id, current_state, last_heartbeat_at, last_geofence_status, session_version
            ) VALUES (
                NEW.session_id, NEW.employee_id, 'ACTIVE', NEW.event_timestamp, true, 1
            );
        END IF;
        RETURN NEW;
    END IF;

    -- Calculate delta timing based on state transition
    IF v_state_val = 'ACTIVE' THEN
        v_prod_delta := EXTRACT(EPOCH FROM (NEW.event_timestamp - v_last_time))::INT;
    ELSIF v_state_val = 'ON_BREAK' OR v_state_val = 'AUTO_BREAK' THEN
        v_break_delta := EXTRACT(EPOCH FROM (NEW.event_timestamp - v_last_time))::INT;
    END IF;

    -- Update state mapping based on new event
    CASE NEW.event_type
        WHEN 'BREAK_STARTED' THEN v_state_val := 'ON_BREAK';
        WHEN 'AUTO_BREAK_TRIGGERED' THEN v_state_val := 'AUTO_BREAK';
        WHEN 'BREAK_ENDED', 'GPS_REENTRY' THEN v_state_val := 'ACTIVE';
        WHEN 'GPS_EXIT' THEN v_state_val := 'GEO_OUTSIDE';
        WHEN 'CLOCK_OUT', 'FORCE_LOGOUT' THEN v_state_val := 'CLOCKED_OUT';
        ELSE
            -- Telemetry keep current state
    END CASE;

    UPDATE public.attendance_projections
    SET
        current_state = v_state_val,
        productive_seconds = productive_seconds + COALESCE(v_prod_delta, 0),
        break_seconds = break_seconds + COALESCE(v_break_delta, 0),
        last_heartbeat_at = NEW.event_timestamp,
        session_version = session_version + 1,
        updated_at = now()
    WHERE session_id = NEW.session_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_apply_events ON public.attendance_events;
CREATE TRIGGER trg_apply_events
    AFTER INSERT ON public.attendance_events
    FOR EACH ROW EXECUTE FUNCTION public.apply_event_to_projection();

-- 6. Heartbeat Transaction Writer Function (RPC)
CREATE OR REPLACE FUNCTION public.write_heartbeat_event(
    p_session_id UUID,
    p_employee_id UUID,
    p_event_type public.attendance_event_type,
    p_sequence INT,
    p_idempotency VARCHAR,
    p_client_ip TEXT,
    p_lat NUMERIC,
    p_lng NUMERIC,
    p_accuracy NUMERIC,
    p_status VARCHAR,
    p_payload JSONB
) RETURNS VOID AS $$
DECLARE
    v_locked_session_id UUID;
    v_last_sequence INT;
BEGIN
    -- 1. Obtain strict write lock on the master session row
    SELECT id INTO v_locked_session_id
    FROM public.attendance
    WHERE id = p_session_id AND employee_id = p_employee_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance session not found or access denied.';
    END IF;

    -- 2. Verify sequence order to block duplicate/delayed heartbeats
    SELECT COALESCE(MAX(sequence_number), 0) INTO v_last_sequence
    FROM public.attendance_events
    WHERE session_id = p_session_id;

    IF p_sequence <= v_last_sequence THEN
        -- Replay protection - discard older sequences silently
        RETURN;
    END IF;

    -- 3. Insert into the immutable event-store partition
    INSERT INTO public.attendance_events (
        session_id,
        employee_id,
        event_type,
        sequence_number,
        idempotency_key,
        client_ip,
        gps_lat,
        gps_lng,
        gps_accuracy,
        payload
    ) VALUES (
        p_session_id,
        p_employee_id,
        p_event_type,
        p_sequence,
        p_idempotency,
        COALESCE(p_client_ip, '0.0.0.0')::inet,
        p_lat,
        p_lng,
        p_accuracy,
        p_payload
    );

    -- 4. Update the status cache projection on master table
    UPDATE public.attendance
    SET 
        status = p_status,
        last_heartbeat_at = now()
    WHERE id = p_session_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
