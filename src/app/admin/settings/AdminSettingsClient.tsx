'use client';

import { useState, useEffect } from 'react';
import { MapPin, Save, Loader2, CheckCircle2, ExternalLink, Navigation, Building, AlertCircle, Crosshair, HelpCircle, X, Info, Smartphone, Download, Laptop } from 'lucide-react';
import Image from 'next/image';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { OFFICE_LOCATION } from '@/lib/location';
import { getOfficeLocation, saveOfficeLocation, getSystemStatus, getNotificationPreferences, saveNotificationPreferences } from './actions';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminSettingsClient() {
  const [lat, setLat] = useState(String(OFFICE_LOCATION.lat));
  const [lng, setLng] = useState(String(OFFICE_LOCATION.lng));
  const [name, setName] = useState(OFFICE_LOCATION.name);
  const [radius, setRadius] = useState(String(OFFICE_LOCATION.radiusMeters));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [origLat, setOrigLat] = useState(String(OFFICE_LOCATION.lat));
  const [origLng, setOrigLng] = useState(String(OFFICE_LOCATION.lng));
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordVerifyInput, setPasswordVerifyInput] = useState('');
  interface SystemNodeStatus {
    node_name: string;
    status: string;
    color: string;
    id?: string;
    last_checked?: string;
  }
  const [systemNodes, setSystemNodes] = useState<SystemNodeStatus[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [notifLeave, setNotifLeave] = useState(true);
  const [notifWFH, setNotifWFH] = useState(true);
  const [notifInquiry, setNotifInquiry] = useState(true);
  const [notifDigest, setNotifDigest] = useState(false);
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [savingNotifs, setSavingNotifs] = useState(false);

  // PWA states and logic
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
        // @ts-expect-error - navigator.standalone is an iOS-specific Safari property
        || window.navigator.standalone;
      setIsStandalone(isStandaloneMode);

      const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      showNotification('To install, tap your browser menu (or share button on Safari) and select "Add to Home Screen".', 'info');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      showNotification('Portal App installation initiated successfully.', 'success');
    }
  };

  const handleSaveNotifs = async () => {
    setSavingNotifs(true);
    try {
      const res = await saveNotificationPreferences({
        notifLeave,
        notifWFH,
        notifInquiry,
        notifDigest,
        audioAlerts
      });
      if (res && res.success) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('primetek-notif-leave', String(notifLeave));
          localStorage.setItem('primetek-notif-wfh', String(notifWFH));
          localStorage.setItem('primetek-notif-inquiry', String(notifInquiry));
          localStorage.setItem('primetek-notif-digest', String(notifDigest));
          localStorage.setItem('primetek-notif-audio', String(audioAlerts));
        }
        showNotification('Notification preferences saved successfully.', 'success');
      } else {
        showNotification(res?.error || 'Failed to save notification preferences.', 'error');
      }
    } catch (err) {
      showNotification('Failed to save notification preferences.', 'error');
    } finally {
      setSavingNotifs(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const [office, nodes, prefs] = await Promise.all([
          getOfficeLocation(),
          getSystemStatus(),
          getNotificationPreferences()
        ]);
        if (office) {
          const latVal = String(office.lat || OFFICE_LOCATION.lat);
          const lngVal = String(office.lng || OFFICE_LOCATION.lng);
          setLat(latVal);
          setLng(lngVal);
          setOrigLat(latVal);
          setOrigLng(lngVal);
          setName(office.name || OFFICE_LOCATION.name);
          setRadius(String(office.radius_meters || OFFICE_LOCATION.radiusMeters));
        }
        setSystemNodes(nodes);
        
        if (prefs) {
          setNotifLeave(prefs.notifLeave);
          setNotifWFH(prefs.notifWFH);
          setNotifInquiry(prefs.notifInquiry);
          setNotifDigest(prefs.notifDigest);
          setAudioAlerts(prefs.audioAlerts);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Reset map error state when coordinate inputs are edited
  useEffect(() => {
    setMapError(false);
  }, [lat, lng]);

  const handleSaveConfirm = async () => {
    if (!passwordVerifyInput) {
      showNotification('Please enter your admin password.', 'error');
      return;
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRadius = parseInt(radius);

    setSaving(true);
    try {
      const res = await saveOfficeLocation({
        name,
        lat: parsedLat,
        lng: parsedLng,
        radius_meters: parsedRadius
      }, passwordVerifyInput);
      
      if (res && res.success) {
        setSaved(true);
        setOrigLat(lat);
        setOrigLng(lng);
        setShowPasswordModal(false);
        setPasswordVerifyInput('');
        showNotification('Settings saved successfully.', 'success');
        setTimeout(() => setSaved(false), 4000);
      } else {
        showNotification(res?.error || 'Failed to save settings', 'error');
      }
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      showNotification(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRadius = parseInt(radius);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      showNotification('Please enter a valid numeric latitude between -90 and 90.', 'error');
      return;
    }
    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      showNotification('Please enter a valid numeric longitude between -180 and 180.', 'error');
      return;
    }
    if (isNaN(parsedRadius) || parsedRadius < 50 || parsedRadius > 5000) {
      showNotification('Please enter a valid radius between 50 and 5000 meters.', 'error');
      return;
    }

    const coordsChanged = (parsedLat !== parseFloat(origLat)) || (parsedLng !== parseFloat(origLng));
    
    if (coordsChanged) {
      setShowPasswordModal(true);
      return;
    }

    setSaving(true);
    try {
      const res = await saveOfficeLocation({
        name,
        lat: parsedLat,
        lng: parsedLng,
        radius_meters: parsedRadius
      });
      if (res && res.success) {
        setSaved(true);
        showNotification('Settings saved successfully.', 'success');
        setTimeout(() => setSaved(false), 4000);
      } else {
        showNotification(res?.error || 'Failed to save settings', 'error');
      }
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      showNotification(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const detectCurrentLocation = () => {
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setDetectingLocation(false);
        setMapError(false);
        showNotification('Location synced successfully.', 'success');
      },
      () => {
        showNotification('Could not detect location automatically. Please enter coordinates manually or verify geolocation permissions.', 'error');
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=17`;
  const inputClasses = 'w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/20 transition-all text-xs font-semibold shadow-2xs';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-lg border border-zinc-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary-500" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">System Settings</h1>
          </div>
          <p className="text-xs text-zinc-500">
            Define the office geofence and radius boundaries for employee attendance validation.
          </p>
        </div>
      </div>

      {/* 1. Location Configuration (Full Width on desktop) */}
      <div className="w-full">
        <Card hover={false} className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
            <MapPin className="w-48 h-48 text-navy-900" />
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-md bg-primary-500/10 text-primary-600 border border-primary-500/20 flex items-center justify-center">
              <Building className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-navy-900 tracking-tight">Office Geofence</h2>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Office Configuration</p>
            </div>
          </div>

          {/* Responsive Layout: List View on Desktop, Stacked View on Mobile */}
          <div className="divide-y divide-zinc-100 lg:divide-y lg:divide-zinc-100">
            {/* Row 1: Office Name */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-4 first:pt-0 gap-2 lg:gap-6">
              <div className="space-y-0.5">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider ml-0.5 lg:text-[10px] lg:text-navy-900 lg:font-semibold lg:normal-case">
                  Office Name
                </label>
                <p className="hidden lg:block text-[10px] text-zinc-455 leading-relaxed max-w-sm">
                  Display name of the office facility used for employee greetings and reports.
                </p>
              </div>
              <div className="w-full lg:w-[400px]">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Primetek HQ, Hyderabad"
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Row 2: GPS Coordinates */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-4 gap-2 lg:gap-6">
              <div className="space-y-0.5">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider ml-0.5 lg:text-[10px] lg:text-navy-900 lg:font-semibold lg:normal-case">
                  GPS Coordinates
                </label>
                <p className="hidden lg:block text-[10px] text-zinc-455 leading-relaxed max-w-sm">
                  Center point coordinates (latitude & longitude) for geofence validation.
                </p>
              </div>
              <div className="w-full lg:w-[400px] flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 lg:space-y-0">
                    <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider ml-0.5 lg:hidden">Latitude</label>
                    <input
                      type="text"
                      placeholder="Latitude"
                      value={lat}
                      onChange={(e) => {
                        setLat(e.target.value);
                        setMapError(false);
                      }}
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-1.5 lg:space-y-0">
                    <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider ml-0.5 lg:hidden">Longitude</label>
                    <input
                      type="text"
                      placeholder="Longitude"
                      value={lng}
                      onChange={(e) => {
                        setLng(e.target.value);
                        setMapError(false);
                      }}
                      className={inputClasses}
                    />
                  </div>
                </div>
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={detectCurrentLocation}
                    disabled={detectingLocation}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-primary-700 hover:text-primary-800 uppercase tracking-wider transition-all disabled:opacity-50 group cursor-pointer"
                  >
                    {detectingLocation ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Locating...</>
                    ) : (
                      <><Crosshair className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> Sync with Current Position</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Row 3: Radius */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-4 gap-2 lg:gap-6">
              <div className="space-y-0.5">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider ml-0.5 lg:text-[10px] lg:text-navy-900 lg:font-semibold lg:normal-case">
                  Geofence Radius
                </label>
                <p className="hidden lg:block text-[10px] text-zinc-455 leading-relaxed max-w-sm">
                  Allowable distance in meters from center coordinates. Recommended: 300 meters.
                </p>
              </div>
              <div className="w-full lg:w-[400px]">
                <div className="relative group">
                  <input
                    type="number"
                    min={50}
                    max={5000}
                    step={50}
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    className={inputClasses}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-400">METERS</div>
                </div>
                <p className="text-[10px] text-zinc-450 mt-1.5 font-medium leading-normal lg:hidden">
                  Allowable distance from the office coordinate for check-in validation. Recommended: 300 meters.
                </p>
              </div>
            </div>

            {/* Row 4: Actions & Save */}
            <div className="flex items-center justify-between lg:justify-end gap-3.5 pt-4">
              {saved && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Settings Saved
                </motion.div>
              )}
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="bg-navy-900 hover:bg-navy-950 text-white rounded-md px-4 py-2 font-semibold shadow-sm active:scale-[0.98] transition-all text-xs"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Settings</>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* 2. Visual Preview & Documentation (Side-by-side on desktop, stacked on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Map Preview */}
        <Card hover={false} className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-white overflow-hidden h-full flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-navy-900 tracking-tight">Office Location Preview</h2>
            <div className="px-2.5 py-0.5 rounded-full bg-zinc-50 border border-zinc-200 text-[8px] font-bold text-zinc-400 uppercase tracking-wider">
              Google Maps Coordinates
            </div>
          </div>
          
          <div className="relative w-full h-64 bg-zinc-50 rounded-lg overflow-hidden border border-zinc-200 group shadow-inner-xs flex-1">
            {lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) ? (
              <iframe
                key={`${lat}-${lng}`}
                src={`https://maps.google.com/maps?q=${parseFloat(lat)},${parseFloat(lng)}&t=&z=17&ie=UTF8&iwloc=&output=embed`}
                className="w-full h-full border-0 rounded-lg"
                allowFullScreen
                loading="lazy"
                title="Office location map preview"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-zinc-50">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-navy-900 uppercase tracking-tight">Preview Unavailable</p>
                <p className="text-[11px] text-zinc-455 mt-1 font-medium">Please enter valid latitude and longitude coordinates to view the map.</p>
              </div>
            )}
            
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 bg-transparent z-10"
              aria-label="View on Google Maps"
            />
            
            <div className="absolute bottom-4 right-4 z-20">
              <div className="px-3 py-1.5 rounded-md bg-white/95 backdrop-blur-xs border border-zinc-200 shadow-sm flex items-center gap-1.5 text-[9px] font-bold text-navy-900 uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                Office Coordinate
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4 px-1">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Coordinates</p>
              <p className="text-xs font-semibold text-navy-900 font-mono">{lat}, {lng}</p>
            </div>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1 text-[9px] font-bold text-primary-700 hover:text-primary-800 uppercase tracking-wider transition-all"
            >
              Google Maps <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </div>
        </Card>

        {/* Guidelines */}
        <Card hover={false} className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-zinc-50 text-navy-900 overflow-hidden relative h-full flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
            <HelpCircle className="w-48 h-48 text-navy-900" />
          </div>
          
          <h2 className="text-sm font-semibold mb-6 tracking-tight flex items-center gap-2 text-navy-900">
            <HelpCircle className="w-5 h-5 text-primary-500" />
            Geofence Guide
          </h2>
          
          <div className="space-y-4 flex-1">
            {[
              { 
                title: 'Mobile Check-in', 
                desc: 'Stand at the center of the office facility using a mobile device for maximum GPS precision.', 
                icon: Crosshair 
              },
              { 
                title: 'Google Maps Coordinates', 
                desc: 'Right-click on Google Maps to extract raw coordinate strings for manual injection.', 
                icon: MapPin 
              },
              { 
                title: 'Geofence Radius', 
                desc: 'A geofence radius of 300m ensures a balance between accurate validation and mobile GPS fluctuations.', 
                icon: Building 
              }
            ].map((step, idx) => (
              <div key={idx} className="flex gap-3.5 group">
                <div className="shrink-0 w-6 h-6 rounded-md bg-primary-500/10 text-primary-600 border border-primary-500/20 flex items-center justify-center text-[10px] font-bold">
                  {idx + 1}
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider mb-0.5 group-hover:text-primary-700 transition-colors">{step.title}</h4>
                  <p className="text-[11px] text-zinc-550 leading-relaxed font-medium">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-200/60 space-y-1.5">
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">System Integrations:</p>
            {systemNodes.map((node, i) => (
              <p key={i} className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                {node.node_name}: <span className={cn(
                  node.status === 'Active' || node.status === 'Optimal' ? "text-emerald-600" : "text-amber-600"
                )}>{node.status}</span>
              </p>
            ))}
            {systemNodes.length === 0 && (
              <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                System Status: <span className="text-emerald-600 font-bold">Operational</span>
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* 3. Notification Settings */}
      <div id="notifications" className="scroll-mt-20">
        <Card hover={false} className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
            <Save className="w-48 h-48 text-navy-900" />
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-md bg-violet-500/10 text-violet-700 border border-violet-500/20 flex items-center justify-center">
              <Save className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-navy-900 tracking-tight">Notification Settings</h2>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Alerts & Preferences</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Settings: Email Preferences */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-navy-900 mb-2">Email Notifications</h3>
                
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
                  <div className="space-y-0.5 max-w-[80%]">
                    <h4 className="text-xs font-semibold text-navy-900">Leave Requests</h4>
                    <p className="text-[10px] text-zinc-450 leading-relaxed">Receive alert emails when employees submit casual or unpaid leave requests.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={notifLeave} 
                      onChange={(e) => setNotifLeave(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
                  <div className="space-y-0.5 max-w-[80%]">
                    <h4 className="text-xs font-semibold text-navy-900">WFH Requests</h4>
                    <p className="text-[10px] text-zinc-450 leading-relaxed">Receive alert emails when employees submit geofenced WFH check-in authorizations.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={notifWFH} 
                      onChange={(e) => setNotifWFH(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
                  <div className="space-y-0.5 max-w-[80%]">
                    <h4 className="text-xs font-semibold text-navy-900">Contact Inquiries</h4>
                    <p className="text-[10px] text-zinc-450 leading-relaxed">Receive alert emails for new sales or general portal support inquiries.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={notifInquiry} 
                      onChange={(e) => setNotifInquiry(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>
              </div>

              {/* Right Settings: General Preferences */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-navy-900 mb-2">Digest & System Preferences</h3>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
                  <div className="space-y-0.5 max-w-[80%]">
                    <h4 className="text-xs font-semibold text-navy-900">Weekly Reports Digest <span className="text-primary-600 font-bold text-[9px] tracking-wide uppercase">(Coming Soon)</span></h4>
                    <p className="text-[10px] text-zinc-450 leading-relaxed">Compile a weekly summary digest of all submitted recruitment metrics every Friday evening.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={notifDigest} 
                      onChange={(e) => setNotifDigest(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
                  <div className="space-y-0.5 max-w-[80%]">
                    <h4 className="text-xs font-semibold text-navy-900">Auditory Dashboard Alerts <span className="text-primary-600 font-bold text-[9px] tracking-wide uppercase">(Coming Soon)</span></h4>
                    <p className="text-[10px] text-zinc-450 leading-relaxed">Play a low system chime sound immediately when new entries appear in the Activity Feed.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={audioAlerts} 
                      onChange={(e) => setAudioAlerts(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-zinc-200/60">
              <Button 
                onClick={handleSaveNotifs} 
                disabled={savingNotifs}
                className="bg-primary-500 hover:bg-primary-600 text-white rounded-md px-4 py-2 font-semibold shadow-sm active:scale-[0.98] transition-all text-xs"
              >
                {savingNotifs ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Preferences</>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
 
      {/* 4. PWA App Installation Section */}
      <div id="pwa-install" className="scroll-mt-20">
        <Card hover={false} className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
            <Laptop className="w-48 h-48 text-navy-900" />
          </div>
 
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-md bg-teal-500/10 text-teal-700 border border-teal-500/20 flex items-center justify-center">
              <Laptop className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-navy-900 tracking-tight">Web App Installation</h2>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Desktop & Mobile PWA</p>
            </div>
          </div>
 
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 gap-4">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      isStandalone ? "bg-emerald-400" : "bg-amber-400"
                    )}></span>
                    <span className={cn(
                      "relative inline-flex rounded-full h-2 w-2",
                      isStandalone ? "bg-emerald-500" : "bg-amber-500"
                    )}></span>
                  </span>
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                    {isStandalone ? "App Status: Installed & Running" : "App Status: Not Installed"}
                  </h3>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                  {isStandalone 
                    ? "You are currently running the Primetek Global Solutions portal in its native standalone window. This enables faster launch, clean app framing, and optimal background sync."
                    : "Install this web application as a standalone desktop or mobile app. This unlocks one-click access, standalone app branding, and ensures system notifications are beautifully styled with our app logo."
                  }
                </p>
              </div>
 
              <div className="shrink-0 flex items-center">
                {isStandalone ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 border border-emerald-500/20 bg-emerald-50/50 rounded-lg px-4 py-2.5 shadow-2xs">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" /> Active Standalone Mode
                  </div>
                ) : (
                  <Button
                    onClick={handleInstallClick}
                    className="bg-navy-900 hover:bg-navy-950 text-white rounded-md px-5 py-2.5 font-bold shadow-sm active:scale-[0.98] transition-all text-xs"
                  >
                    <Download className="w-4.5 h-4.5 mr-2" /> One-Click Install App
                  </Button>
                )}
              </div>
            </div>
 
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-200/60 text-navy-900">
              <div className="p-4 rounded-lg border border-zinc-200/60 bg-zinc-50/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary-500" />
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-navy-900">Mobile Installation Tips</h4>
                </div>
                <ul className="list-disc pl-4 text-[10px] text-zinc-500 space-y-1.5 leading-relaxed">
                  <li><strong>Chrome/Edge on Android:</strong> Click the "One-Click Install App" button above or select "Install app" in the browser menu.</li>
                  <li><strong>Safari on iOS:</strong> Tap the <strong>Share</strong> button (box with an up arrow) at the bottom, scroll down, and tap <strong>Add to Home Screen</strong>.</li>
                </ul>
              </div>
 
              <div className="p-4 rounded-lg border border-zinc-200/60 bg-zinc-50/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-violet-500" />
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-navy-900">Why Install the App?</h4>
                </div>
                <ul className="list-disc pl-4 text-[10px] text-zinc-500 space-y-1.5 leading-relaxed">
                  <li><strong>Custom Branding:</strong> System notifications will be delivered with the official Primetek logo/icon instead of your browser's default logo (like Brave or Chrome).</li>
                  <li><strong>Quick Launch:</strong> Creates a shortcut on your home screen or desktop for direct launch.</li>
                  <li><strong>Immersive Experience:</strong> Hides browser navigation bars, tabs, and URL fields for full-screen portal access.</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] w-full max-w-sm px-4"
          >
            <div className={cn(
              "rounded-lg p-3.5 shadow-xl border backdrop-blur-md flex items-start gap-3 bg-white/95",
              notification.type === 'success' ? "border-emerald-500/20 text-emerald-600" :
              notification.type === 'error' ? "border-red-500/20 text-red-600" :
              "border-primary-500/20 text-primary-600"
            )}>
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              ) : notification.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              ) : (
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary-500" />
              )}
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-navy-900">
                  {notification.type === 'success' ? 'Success' : notification.type === 'error' ? 'Error' : 'Notification'}
                </p>
                <p className="text-[11px] mt-0.5 text-zinc-550 font-medium leading-relaxed">{notification.message}</p>
              </div>
              <button onClick={() => setNotification(null)} className="text-navy-950/40 hover:text-navy-950 transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Geofence Password Verification Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div
            onClick={() => {
              setShowPasswordModal(false);
              setPasswordVerifyInput('');
            }}
            className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-navy-900/60 backdrop-blur-md cursor-pointer text-navy-900"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="w-full max-w-sm cursor-default"
            >
              <Card hover={false} className="p-5 rounded-xl border border-border shadow-2xl bg-white relative overflow-hidden">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-red-50 text-red-600 border border-red-200 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-navy-900 tracking-tight">Confirm Location Change</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Authorization Required</p>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    You are changing the active geofence coordinates. Please enter your administrator password to authorize this action.
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Admin Password</label>
                    <input
                      type="password"
                      value={passwordVerifyInput}
                      onChange={(e) => setPasswordVerifyInput(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/20 transition-all text-xs font-semibold"
                    />
                  </div>
                  <div className="flex w-full gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordModal(false);
                        setPasswordVerifyInput('');
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-surface-alt hover:bg-border/60 text-navy-900 text-xs font-semibold transition-all cursor-pointer border border-border"
                    >
                      Cancel
                    </button>
                    <Button
                      onClick={handleSaveConfirm}
                      disabled={saving}
                      size="sm"
                      className="flex-1 bg-navy-900 hover:bg-navy-800 border border-navy-950 text-white text-xs font-semibold"
                    >
                      Authorize & Save
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
