'use client';

import { useState, useEffect } from 'react';
import { MapPin, Save, Loader2, CheckCircle2, ExternalLink, Navigation, Building, AlertCircle, Sparkles, Crosshair, HelpCircle, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { OFFICE_LOCATION } from '@/lib/location';
import { getOfficeLocation, saveOfficeLocation, getSystemStatus } from './actions';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function AdminSettingsPage() {
  const [lat, setLat] = useState(String(OFFICE_LOCATION.lat));
  const [lng, setLng] = useState(String(OFFICE_LOCATION.lng));
  const [name, setName] = useState(OFFICE_LOCATION.name);
  const [radius, setRadius] = useState(String(OFFICE_LOCATION.radiusMeters));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [loading, setLoading] = useState(true);

  const [systemNodes, setSystemNodes] = useState<any[]>([]);

  useEffect(() => {
    async function loadLocation() {
      try {
        const office = await getOfficeLocation();
        if (office) {
          setLat(String(office.lat || OFFICE_LOCATION.lat));
          setLng(String(office.lng || OFFICE_LOCATION.lng));
          setName(office.name || OFFICE_LOCATION.name);
          setRadius(String(office.radius_meters || OFFICE_LOCATION.radiusMeters));
        }

        const nodes = await getSystemStatus();
        setSystemNodes(nodes);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLocation();
  }, []);

  const handleSave = async () => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRadius = parseInt(radius);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      alert('Please enter a valid numeric latitude between -90 and 90.');
      return;
    }
    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      alert('Please enter a valid numeric longitude between -180 and 180.');
      return;
    }
    if (isNaN(parsedRadius) || parsedRadius < 50 || parsedRadius > 5000) {
      alert('Please enter a valid radius between 50 and 5000 meters.');
      return;
    }

    setSaving(true);
    try {
      await saveOfficeLocation({
        name,
        lat: parsedLat,
        lng: parsedLng,
        radius_meters: parsedRadius
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      alert(err instanceof Error ? err.message : 'Failed to save settings');
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
      },
      () => {
        alert('Could not detect location. Please enter coordinates manually.');
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=17`;
  const inputClasses = 'w-full px-5 py-4 rounded-2xl border border-border/60 bg-white text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all text-sm font-medium shadow-sm';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-navy-900 p-8 text-white shadow-xl shadow-navy-900/10">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[100%] bg-primary-500/10 rounded-full blur-[80px]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-200">Infrastructure Config</span>
          </div>
          <h1 className="text-3xl font-heading font-black tracking-tight text-white">System Settings</h1>
          <p className="text-gray-400 text-xs mt-1 font-medium italic">Define the geofence and operational boundaries for the PWA nodes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 1. Location Configuration */}
        <Card hover={false} className="p-10 rounded-[2.5rem] border-border/60 shadow-sm bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
            <MapPin className="w-48 h-48 text-navy-900" />
          </div>

          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-heading font-black text-xl text-navy-900 tracking-tight">Office Geofence</h2>
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mt-0.5">Verification Parameters</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Office Name */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Entity Identifier</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Primetek HQ, Hyderabad"
                className={inputClasses}
              />
            </div>

            {/* Lat / Lng */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Latitude Axis</label>
                <input
                  type="text"
                  placeholder="e.g. 17.448294"
                  value={lat}
                  onChange={(e) => {
                    setLat(e.target.value);
                    setMapError(false);
                  }}
                  className={inputClasses}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Longitude Axis</label>
                <input
                  type="text"
                  placeholder="e.g. 78.374182"
                  value={lng}
                  onChange={(e) => {
                    setLng(e.target.value);
                    setMapError(false);
                  }}
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Auto-detect button */}
            <button
              type="button"
              onClick={detectCurrentLocation}
              disabled={detectingLocation}
              className="flex items-center gap-2 text-xs font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest transition-all disabled:opacity-50 group"
            >
              {detectingLocation ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Calibrating...</>
              ) : (
                <><Crosshair className="w-4 h-4 group-hover:scale-125 transition-transform" /> Sync with Current Position</>
              )}
            </button>

            {/* Radius */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
                Blast Radius (Meters)
              </label>
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
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-text-muted">METERS</div>
              </div>
              <p className="text-[10px] text-text-muted mt-2 font-bold italic">
                Tolerance for attendance verification. Recommended: 300m for high accuracy.
              </p>
            </div>

            {/* Save */}
            <div className="flex items-center gap-4 pt-4">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="bg-navy-900 hover:bg-navy-800 text-white rounded-2xl px-8 py-4 font-black shadow-xl shadow-navy-900/10 active:scale-95 transition-all text-sm"
              >
                {saving ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Syncing...</>
                ) : (
                  <><Save className="w-5 h-5 mr-2" /> Commit Changes</>
                )}
              </Button>
              {saved && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="flex items-center gap-1.5 text-xs font-black text-emerald-600 uppercase tracking-widest"
                >
                  <CheckCircle2 className="w-4 h-4" /> Config Locked
                </motion.div>
              )}
            </div>
          </div>
        </Card>

        {/* 2. Visual Preview & Documentation */}
        <div className="space-y-8">
          {/* Map Preview */}
          <Card hover={false} className="p-10 rounded-[2.5rem] border-border/60 shadow-sm bg-white overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-heading font-black text-xl text-navy-900 tracking-tight">Geospatial Preview</h2>
              <div className="px-3 py-1 rounded-full bg-surface-alt border border-border/60 text-[9px] font-black text-text-muted uppercase tracking-widest">
                Real-time Feedback
              </div>
            </div>
            
            <div className="relative w-full h-64 bg-surface-alt rounded-[2rem] overflow-hidden border border-border/60 group shadow-inner-lg">
              {!mapError ? (
                <Image
                  key={`${lat}-${lng}`}
                  src={`https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=800&height=400&center=lonlat:${(lng || '').trim()},${(lat || '').trim()}&zoom=15.5&marker=lonlat:${(lng || '').trim()},${(lat || '').trim()};color:%230d9488;size:large&apiKey=${env.NEXT_PUBLIC_GEOAPIFY_API_KEY || 'demo'}`}
                  alt="Office location map preview"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
                  onError={() => setMapError(true)}
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-surface-alt">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-black text-navy-900 uppercase tracking-tight">Telemetry Blocked</p>
                  <p className="text-xs text-text-muted mt-2 font-medium">Coordinate data invalid or API synchronization failed.</p>
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
                <div className="px-4 py-2 rounded-xl bg-white/90 backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-2 text-[10px] font-black text-navy-900 uppercase tracking-widest">
                  <MapPin className="w-3 h-3 text-red-500" />
                  Point Active
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-6 px-2">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Global Coordinates</p>
                <p className="text-xs font-bold text-navy-900 font-mono">{lat}, {lng}</p>
              </div>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 text-[10px] font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest transition-all"
              >
                External Node <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            </div>
          </Card>

          {/* Guidelines */}
          <Card hover={false} className="p-10 rounded-[2.5rem] border-border/60 shadow-sm bg-navy-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-10 opacity-[0.05] pointer-events-none">
              <HelpCircle className="w-48 h-48 text-white" />
            </div>
            
            <h2 className="font-heading font-black text-xl mb-8 tracking-tight flex items-center gap-2 text-white">
              <HelpCircle className="w-6 h-6 text-primary-400" />
              Provisioning Guide
            </h2>
            
            <div className="space-y-6">
              {[
                { 
                  title: 'Mobile Calibration', 
                  desc: 'Stand at the center of the office facility using a mobile device for maximum GPS precision.', 
                  icon: Crosshair 
                },
                { 
                  title: 'Maps Integration', 
                  desc: 'Right-click on Google Maps to extract raw coordinate strings for manual injection.', 
                  icon: MapPin 
                },
                { 
                  title: 'Radius Protocol', 
                  desc: 'Default 300m ensures balance between security and GPS signal fluctuation.', 
                  icon: Building 
                }
              ].map((step, idx) => (
                <div key={idx} className="flex gap-4 group">
                  <div className="shrink-0 w-8 h-8 rounded-xl bg-white/10 text-primary-400 flex items-center justify-center text-xs font-black group-hover:bg-primary-500 group-hover:text-white transition-all">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest mb-1 group-hover:text-primary-400 transition-colors">{step.title}</h4>
                    <p className="text-xs text-gray-400 leading-relaxed font-medium">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 pt-8 border-t border-white/10 space-y-2">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Node Vitality Check:</p>
              {systemNodes.map((node, i) => (
                <p key={i} className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center justify-between">
                  {node.node_name}: <span className={cn(
                    node.status === 'Active' || node.status === 'Optimal' ? "text-emerald-500" : "text-amber-500"
                  )}>{node.status}</span>
                </p>
              ))}
              {systemNodes.length === 0 && (
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  System Status: <span className="text-emerald-500">Operational</span>
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
