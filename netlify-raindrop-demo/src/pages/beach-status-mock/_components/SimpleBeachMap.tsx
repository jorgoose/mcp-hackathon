import { useEffect, useRef, useState } from 'react';
import FallbackStaticMap from './FallbackStaticMap';

// Define the beach data interface
interface BeachData {
  beach_name: string;
  status: 'good' | 'caution' | 'no_swim' | 'stale';
  tempF: number;
  wave_height: number;
  last_updated: string;
  label: string;
}

// Chicago beach coordinates from sensor data
const BEACH_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "63rd Street Beach": { lat: 41.784561, lng: -87.571453 },
  "Calumet Beach": { lat: 41.714739, lng: -87.527356 },
  "Montrose Beach": { lat: 41.969094, lng: -87.638003 },
  "Ohio Street Beach": { lat: 41.894328, lng: -87.613083 },
  "Osterman Beach": { lat: 41.987675, lng: -87.651008 },
  "Rainbow Beach": { lat: 41.760147, lng: -87.550081 }
};

// Default center (Chicago)
const DEFAULT_CENTER = { lat: 41.8781, lng: -87.6298 };

interface SimpleBeachMapProps {
  beaches: BeachData[];
}

export default function SimpleBeachMap({ beaches }: SimpleBeachMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapInitAttempted, setMapInitAttempted] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugMessages, setDebugMessages] = useState<string[]>([]);

  // Add location data to beaches
  const beachesWithLocation = beaches.map(beach => ({
    ...beach,
    location: BEACH_COORDINATES[beach.beach_name] || null
  })).filter(beach => beach.location !== null);

  // Log initial beach data
  useEffect(() => {
    logMessage(`[MAP] Initial beach data: ${beaches.length} beaches`);
    logMessage(`[MAP] Beach coordinates: ${Object.keys(BEACH_COORDINATES).length} locations`);
    
    // Log each beach name and whether it has coordinates
    beaches.forEach(beach => {
      const hasCoords = BEACH_COORDINATES[beach.beach_name] !== undefined;
      logMessage(`[MAP] Beach: ${beach.beach_name}, Has coordinates: ${hasCoords}`);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    // Skip if no map container
    if (!mapContainerRef.current) return;
    
    // Mark that we attempted initialization
    setMapInitAttempted(true);
    
    // Check if Leaflet is available
    if (!window.L) {
      logMessage('[MAP] Leaflet not available, showing fallback');
      setMapFailed(true);
      return;
    }

    // Skip if map already initialized
    if (mapRef.current) return;

    try {
      logMessage('[MAP] Initializing map');
      // Set a timeout to detect if map initialization takes too long
      const timeout = setTimeout(() => {
        if (!mapRef.current) {
          logMessage('[MAP] Map initialization timed out');
          setMapFailed(true);
        }
      }, 3000); // 3 second timeout
      
      // Create map instance
      const map = window.L.map(mapContainerRef.current).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 11);
      
      // Add simple tile layer (CartoDB Positron - light, clean style)
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);
      
      // Add minimal styling to the map
      map.attributionControl.setPosition('bottomleft');
      map.zoomControl.setPosition('topright');
      
      // Store map reference
      mapRef.current = map;
      
      // Clear the timeout since map initialized successfully
      clearTimeout(timeout);
      
      // Try to get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            
            // Add simpler user location marker
            const userMarker = window.L.circleMarker([latitude, longitude], {
              radius: 8,
              fillColor: '#4285F4',
              color: 'white',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map);
            
            userMarker.bindPopup('Your Location');
            
            // Center map on user location
            map.setView([latitude, longitude], 11);
          },
          (error) => {
            console.error('[MAP] Error getting user location:', error);
          }
        );
      }
      
      // Clean up on unmount
      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logMessage(`[MAP] ERROR: Error initializing map: ${errorMsg}`);
      setMapFailed(true);
    }
  }, []);

  // Helper function for logging
  const logMessage = (msg: string) => {
    console.log(msg);
    setDebugMessages(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };
  
  // Log available beaches for debugging
  useEffect(() => {
    if (beachesWithLocation.length > 0) {
      logMessage(`[MAP] Found ${beachesWithLocation.length} beaches with location data`);
    } else {
      logMessage('[MAP] WARNING: No beaches with location data available');
    }
  }, [beachesWithLocation]);

  // Update markers when beaches change
  useEffect(() => {
    // Skip if no map
    if (!mapRef.current || !window.L) return;
    
    try {
      logMessage('[MAP] Updating markers');
      
      // Clear existing markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      
      // Add beach markers
      beachesWithLocation.forEach(beach => {
        if (!beach.location) return;
        
        const { lat, lng } = beach.location;
        
        logMessage(`[MAP] Adding marker for ${beach.beach_name} at ${lat},${lng} with status ${beach.status}`);
        
        // Create simpler marker with status color
        const marker = window.L.circleMarker([lat, lng], {
          radius: 12, // Size of the circle
          fillColor: beach.status === 'good' ? '#10B981' : 
                     beach.status === 'caution' ? '#F59E0B' : 
                     beach.status === 'no_swim' ? '#EF4444' : '#6B7280',
          color: 'white', // Border color
          weight: 2, // Border width
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(mapRef.current);
        
        // Add a simple tooltip with beach name and wave height
        marker.bindTooltip(`${beach.beach_name}: ${beach.wave_height.toFixed(1)}m`, {
          permanent: false,
          direction: 'top',
          className: 'simple-tooltip'
        });
        
        // Create simple popup content
        const popupContent = `
          <div style="min-width: 180px;">
            <h3 style="font-weight: bold; margin-bottom: 8px; font-size: 16px;">${beach.beach_name}</h3>
            <p style="margin: 0; line-height: 1.6;">
              Status: <strong>${beach.status.replace('_', ' ')}</strong><br>
              Water: ${beach.tempF}°F<br>
              Waves: ${beach.wave_height} m<br>
              ${beach.label}
            </p>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        markersRef.current.push(marker);
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logMessage(`[MAP] ERROR: Error updating markers: ${errorMsg}`);
    }
  }, [beaches, beachesWithLocation]);

  // Show fallback map if interactive map failed to load
  if (mapFailed && mapInitAttempted) {
    return <FallbackStaticMap beaches={beaches} />;
  }
  
  return (
    <div className="mb-8">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Beach Map</h2>
          <p className="text-sm text-gray-600">
            Map showing beach locations with wave height (meters). Click markers for details.
          </p>
        </div>
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs text-gray-500 hover:text-primary"
        >
          {showDebug ? 'Hide Debug' : 'Debug'}
        </button>
      </div>
      
      {/* Debug information */}
      {showDebug && (
        <div className="mb-4 p-3 bg-gray-100 rounded-md text-xs font-mono overflow-auto max-h-40">
          <h3 className="font-bold mb-1">Debug Information:</h3>
          <ul className="list-disc pl-4 space-y-1">
            <li>Map initialized: {mapRef.current ? 'Yes' : 'No'}</li>
            <li>Markers: {markersRef.current.length}</li>
            <li>Beaches with location: {beachesWithLocation.length}/{beaches.length}</li>
            <li>Leaflet available: {window.L ? 'Yes' : 'No'}</li>
          </ul>
          <h3 className="font-bold mt-3 mb-1">Log:</h3>
          <ul className="list-disc pl-4 space-y-1">
            {debugMessages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div 
        ref={mapContainerRef} 
        className="h-[400px] w-full rounded-lg border border-gray-200 shadow-sm"
      ></div>
      <div className="mt-4 p-3 bg-white border border-gray-200 rounded-md shadow-sm">
        <p className="text-xs text-gray-500 mb-2">Beach Status Legend:</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#10B981] rounded-full border border-white"></div>
            <span className="text-sm">Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#F59E0B] rounded-full border border-white"></div>
            <span className="text-sm">Caution</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#EF4444] rounded-full border border-white"></div>
            <span className="text-sm">No Swim</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#6B7280] rounded-full border border-white"></div>
            <span className="text-sm">Stale</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#4285F4] rounded-full border border-white"></div>
            <span className="text-sm">Your Location</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add global type for Leaflet
declare global {
  interface Window {
    L: any;
  }
}
