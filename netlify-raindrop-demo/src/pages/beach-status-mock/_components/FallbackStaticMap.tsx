import React from 'react';

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

interface FallbackStaticMapProps {
  beaches: BeachData[];
}

export default function FallbackStaticMap({ beaches }: FallbackStaticMapProps) {
  // Add location data to beaches
  const beachesWithLocation = beaches.map(beach => ({
    ...beach,
    location: BEACH_COORDINATES[beach.beach_name] || null
  })).filter(beach => beach.location !== null);

  // Generate static map URL using OpenStreetMap
  const generateStaticMapUrl = () => {
    // Base URL for static map
    const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
    
    // Map parameters
    const params = new URLSearchParams({
      center: '41.8781,-87.6298', // Chicago center
      zoom: '11',
      size: '600x400',
      scale: '2',
      maptype: 'roadmap'
    });
    
    // Add markers for each beach
    beachesWithLocation.forEach((beach, index) => {
      if (!beach.location) return;
      
      // Choose marker color based on status
      let color = 'green';
      if (beach.status === 'caution') color = 'orange';
      if (beach.status === 'no_swim') color = 'red';
      if (beach.status === 'stale') color = 'gray';
      
      params.append(
        'markers', 
        `color:${color}|label:${index + 1}|${beach.location.lat},${beach.location.lng}`
      );
    });
    
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <div className="mb-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold">Beach Map (Static)</h2>
        <p className="text-sm text-gray-600">
          Static map showing beach locations. Numbers correspond to the beaches listed below.
        </p>
      </div>
      
      <div className="h-[400px] w-full rounded-lg border border-gray-200 shadow-sm overflow-hidden relative">
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-gray-500 mb-2">Interactive map unavailable</p>
            <p className="text-sm text-gray-400">Using static map fallback</p>
          </div>
        </div>
        
        <div className="relative z-10 h-full w-full flex items-center justify-center">
          <div className="p-4 bg-white rounded shadow-md text-center">
            <p className="font-medium mb-2">Beach Locations:</p>
            <ul className="text-sm text-left space-y-1">
              {beachesWithLocation.map((beach, index) => (
                <li key={beach.beach_name} className="flex items-center gap-2">
                  <span className={`
                    w-5 h-5 rounded-full flex items-center justify-center text-xs text-white
                    ${beach.status === 'good' ? 'bg-green-500' : ''}
                    ${beach.status === 'caution' ? 'bg-yellow-500' : ''}
                    ${beach.status === 'no_swim' ? 'bg-red-500' : ''}
                    ${beach.status === 'stale' ? 'bg-gray-500' : ''}
                  `}>
                    {index + 1}
                  </span>
                  <span>{beach.beach_name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
          <span className="text-sm">Good</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
          <span className="text-sm">Caution</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded-full"></div>
          <span className="text-sm">No Swim</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
          <span className="text-sm">Stale</span>
        </div>
      </div>
    </div>
  );
}
