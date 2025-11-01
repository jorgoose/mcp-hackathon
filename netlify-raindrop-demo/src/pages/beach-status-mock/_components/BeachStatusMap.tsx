import { useEffect, useRef, useState } from 'react';

// Define the beach data interface
interface BeachData {
  beach_name: string;
  status: 'good' | 'caution' | 'no_swim' | 'stale';
  tempF: number;
  wave_height: number;
  last_updated: string;
  label: string;
  // Add location data
  location?: {
    lat: number;
    lng: number;
  };
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

interface BeachStatusMapProps {
  beaches: BeachData[];
}

export default function BeachStatusMap({ beaches }: BeachStatusMapProps) {
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  // Helper function to log debug information
  const logDebug = (message: string) => {
    console.log(`[MAP] ${message}`);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };
  const mapRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);

  // Add location data to beaches
  const beachesWithLocation = beaches.map(beach => ({
    ...beach,
    location: BEACH_COORDINATES[beach.beach_name] || null
  })).filter(beach => beach.location !== null);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting user location:', error);
        }
      );
    }
  }, []);

  // Initialize map when component mounts
  useEffect(() => {
    if (!mapRef.current || mapInitialized) return;

    // Create a function to initialize Leaflet
    const initLeaflet = () => {
      // First add the CSS
      if (!document.getElementById('leaflet-css')) {
        logDebug('Loading Leaflet CSS');
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = 'anonymous';
        
        link.onload = () => logDebug('Leaflet CSS loaded');
        link.onerror = () => logDebug('ERROR: Failed to load Leaflet CSS');
        
        document.head.appendChild(link);
      } else {
        logDebug('Leaflet CSS already loaded');
      }

      // Wait for CSS to load before loading JS
      setTimeout(() => {
        // Then load the JS
        if (!window.L) {
          logDebug('Loading Leaflet script');
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
          script.crossOrigin = '';
          script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
          
          script.onload = () => {
            logDebug('Leaflet script loaded');
            // Only set initialized after script is fully loaded
            setTimeout(() => {
              if (window.L) {
                logDebug('Leaflet global object available');
                setMapInitialized(true);
              } else {
                logDebug('ERROR: Leaflet script loaded but L is not defined');
                setMapError('Map library failed to initialize properly. Please try refreshing the page.');
              }
            }, 500);
          };
          
          script.onerror = (e) => {
            logDebug(`ERROR: Failed to load Leaflet script: ${e}`);
            setMapError('Failed to load map library. Please check your internet connection and try again.');
          };
          
          document.head.appendChild(script);
        } else {
          logDebug('Leaflet already loaded');
          setMapInitialized(true);
        }
      }, 300);
    };

    // Add custom CSS for markers
    if (!document.getElementById('custom-map-styles')) {
      const style = document.createElement('style');
      style.id = 'custom-map-styles';
      style.innerHTML = `
        .user-location-marker {
          background-color: transparent;
        }
        .user-marker-inner {
          width: 20px;
          height: 20px;
          background-color: #4285F4;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 5px rgba(0,0,0,0.3);
        }
        .beach-marker {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          color: white;
          font-weight: bold;
          box-shadow: 0 0 5px rgba(0,0,0,0.3);
        }
        .beach-marker-good {
          background-color: #10B981;
        }
        .beach-marker-caution {
          background-color: #F59E0B;
        }
        .beach-marker-no_swim {
          background-color: #EF4444;
        }
        .beach-marker-stale {
          background-color: #6B7280;
        }
      `;
      document.head.appendChild(style);
    }

    // Initialize Leaflet
    initLeaflet();
  }, [mapRef]);

  // Initialize map after Leaflet is loaded
  useEffect(() => {
    if (!mapInitialized || !mapRef.current || map) return;

    // Double check that Leaflet is actually loaded
    if (!window.L) {
      logDebug('ERROR: Leaflet not found, retrying initialization');
      setMapInitialized(false);
      setIsMapLoading(true);
      return;
    }

    logDebug('Initializing map with Leaflet');
    try {
      const L = window.L;
      const center = userLocation || DEFAULT_CENTER;
      
      const newMap = L.map(mapRef.current).setView([center.lat, center.lng], 12);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(newMap);

      // Add user location marker if available
      if (userLocation) {
        L.marker([userLocation.lat, userLocation.lng], {
          icon: L.divIcon({
            className: 'user-location-marker',
            html: '<div class="user-marker-inner"></div>',
            iconSize: [20, 20]
          })
        })
        .addTo(newMap)
        .bindPopup('Your Location');
      }

      logDebug('Map created successfully');
      setMap(newMap);
      setIsMapLoading(false);

      return () => {
        if (newMap) {
          newMap.remove();
        }
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logDebug(`ERROR: Error initializing map: ${errorMsg}`);
      // If there's an error, set the error state
      setMapError('Failed to initialize map. Please try refreshing the page.');
      setMapInitialized(false);
      setIsMapLoading(false);
    }
  }, [mapInitialized, userLocation, map]);

  // Update markers when beaches or map changes
  useEffect(() => {
    if (!map || !beachesWithLocation.length || !window.L) return;

    try {
      // Clear existing markers
      markers.forEach(marker => marker.remove());
      const newMarkers: any[] = [];

      // Add beach markers
      beachesWithLocation.forEach(beach => {
        if (!beach.location) return;
        
        const { lat, lng } = beach.location;
        
        const marker = window.L.marker([lat, lng], {
          icon: window.L.divIcon({
            className: `beach-marker beach-marker-${beach.status}`,
            html: `<div>${beach.wave_height.toFixed(1)}</div>`,
            iconSize: [36, 36]
          })
        }).addTo(map);
        
        // Create popup content
        const popupContent = `
          <div style="min-width: 200px;">
            <h3 style="font-weight: bold; margin-bottom: 8px;">${beach.beach_name}</h3>
            <p>
              Water: ${beach.tempF}°F<br>
              Waves: ${beach.wave_height} m<br>
              Status: ${beach.status.replace('_', ' ').toUpperCase()}<br>
              ${beach.label}
            </p>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        newMarkers.push(marker);
      });
      
      setMarkers(newMarkers);
    } catch (error) {
      console.error('Error adding markers to map:', error);
      setMapError('Failed to display beach markers. Please try refreshing the page.');
    }
  }, [map, beachesWithLocation]);

  // Show loading state
  if (isMapLoading && !mapError && !map) {
    return (
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Beach Map</h2>
          <p className="text-sm text-gray-600">
            Map showing beach locations with wave height (meters).
          </p>
        </div>
        <div className="h-[400px] w-full rounded-lg border border-gray-200 shadow-sm flex items-center justify-center bg-gray-50">
          <div className="text-center p-6">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-primary mb-4"></div>
              <p className="text-gray-600">Loading map...</p>
            </div>
            
            {/* Debug information */}
            {debugInfo.length > 0 && (
              <details className="mt-4 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer">Loading Status</summary>
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono text-gray-700 max-h-40 overflow-y-auto">
                  <ul className="list-disc pl-4 space-y-1">
                    {debugInfo.map((info, i) => (
                      <li key={i}>{info}</li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show error message if map failed to load
  if (mapError) {
    return (
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Beach Map</h2>
          <p className="text-sm text-gray-600">
            Map showing beach locations with wave height (meters).
          </p>
        </div>
        <div className="h-[400px] w-full rounded-lg border border-gray-200 shadow-sm flex items-center justify-center bg-gray-50">
          <div className="text-center p-6">
            <p className="text-red-500 mb-2">{mapError}</p>
            <button 
              onClick={() => {
                logDebug('Retrying map initialization');
                setMapError(null);
                setMapInitialized(false);
                setMap(null);
                setIsMapLoading(true);
                setDebugInfo([]);
              }}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark mb-4"
            >
              Retry Loading Map
            </button>
            
            {/* Debug information */}
            <details className="mt-4 text-left">
              <summary className="text-sm text-gray-500 cursor-pointer">Debug Information</summary>
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono text-gray-700 max-h-40 overflow-y-auto">
                {debugInfo.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-1">
                    {debugInfo.map((info, i) => (
                      <li key={i}>{info}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No debug information available</p>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold">Beach Map</h2>
        <p className="text-sm text-gray-600">
          Map showing beach locations with wave height (meters). Click markers for details.
        </p>
      </div>
      <div 
        ref={mapRef} 
        className="h-[400px] w-full rounded-lg border border-gray-200 shadow-sm"
      ></div>
      <div className="mt-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#10B981] rounded-full"></div>
          <span className="text-sm">Good</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#F59E0B] rounded-full"></div>
          <span className="text-sm">Caution</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#EF4444] rounded-full"></div>
          <span className="text-sm">No Swim</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#6B7280] rounded-full"></div>
          <span className="text-sm">Stale</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#4285F4] border-2 border-white rounded-full"></div>
          <span className="text-sm">Your Location</span>
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
