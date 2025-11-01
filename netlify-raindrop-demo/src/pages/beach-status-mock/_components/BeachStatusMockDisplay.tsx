import { useEffect, useState } from 'react';
import SimpleBeachMap from './SimpleBeachMap';

interface BeachData {
  beach_name: string;
  status: 'good' | 'caution' | 'no_swim' | 'stale';
  tempF: number;
  wave_height: number;
  last_updated: string;
  label: string;
}

interface ApiResponse {
  success: boolean;
  data?: BeachData[];
  error?: string;
}

export default function BeachStatusMockDisplay() {
  const [beaches, setBeaches] = useState<BeachData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState<string>(() => {
    // Default to current date
    return new Date().toISOString().split('T')[0];
  });

  const fetchBeachData = async (date?: string) => {
    try {
      console.log('[UI] Starting mock beach data fetch');
      setLoading(true);
      
      const queryDate = date || startDate;
      console.log(`[UI] Fetching mock beach data from ${queryDate}`);
      
      const fetchStartTime = Date.now();
      const response = await fetch(`/api/beach-status-mock?startDate=${queryDate}`);
      const fetchEndTime = Date.now();
      
      console.log(`[UI] Fetch completed in ${fetchEndTime - fetchStartTime}ms with status: ${response.status}`);
      
      const data: ApiResponse & { metadata?: any } = await response.json();
      
      console.log('[UI] Response data received:', {
        success: data.success,
        beachCount: data.data?.length || 0,
        metadata: data.metadata,
        error: data.error
      });
      
      if (data.success && data.data) {
        console.log(`[UI] Received ${data.data.length} beaches`);
        
        if (data.data.length > 0) {
          // Log status counts
          const statusCounts = data.data.reduce((acc, beach) => {
            acc[beach.status] = (acc[beach.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          console.log('[UI] Beach status counts:', statusCounts);
          
          // Log sample beach data
          console.log('[UI] Sample beach data:', data.data[0]);
        } else {
          console.log('[UI] No beach data received');
        }
        
        setBeaches(data.data);
        setError(null);
      } else {
        console.error('[UI] API returned error or no data:', data.error);
        setError(data.error || 'Failed to fetch beach data');
        setBeaches([]);
      }
    } catch (err) {
      console.error('[UI] Error fetching beach data:', err);
      setError('Error connecting to beach status API');
      setBeaches([]);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
      console.log('[UI] Beach data fetch completed');
    }
  };

  useEffect(() => {
    fetchBeachData();
    
    // Refresh data every 10 minutes
    const interval = setInterval(() => fetchBeachData(), 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [startDate]);

  const getStatusBadge = (status: BeachData['status']) => {
    switch (status) {
      case 'good':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Good</span>;
      case 'caution':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Caution</span>;
      case 'no_swim':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">No Swim</span>;
      case 'stale':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Stale</span>;
      default:
        return null;
    }
  };

  if (loading && beaches.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-pulse flex space-x-2">
          <div className="h-2 w-2 bg-primary rounded-full"></div>
          <div className="h-2 w-2 bg-primary rounded-full"></div>
          <div className="h-2 w-2 bg-primary rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error && beaches.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4">
        <p className="text-red-700">No current data available</p>
      </div>
    );
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    console.log(`[UI] Date changed from ${startDate} to ${newDate}`);
    setStartDate(newDate);
  };

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Chicago Beach Status (Mock Data)</h2>
        <button 
          onClick={() => fetchBeachData()}
          className="text-sm text-primary hover:underline flex items-center"
        >
          Refresh
        </button>
      </div>
      
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Show data from:
        </label>
        <div className="flex gap-4 items-center">
          <input
            type="date"
            value={startDate}
            onChange={handleDateChange}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <button
            onClick={() => {
              // Reset to today's date
              const today = new Date().toISOString().split('T')[0];
              setStartDate(today);
            }}
            className="text-sm text-primary hover:underline"
          >
            Reset to Today
          </button>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        {lastUpdated && (
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
        <p className="text-sm text-gray-500">
          Showing data from: <span className="font-medium">{new Date(startDate).toLocaleDateString()}</span>
        </p>
      </div>
      
      {/* Map View */}
      {beaches.length > 0 && (
        <SimpleBeachMap beaches={beaches} />
      )}

      {/* List View */}
      <div className="space-y-4">
        {beaches.map((beach) => (
          <div 
            key={beach.beach_name}
            className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold">{beach.beach_name}</h3>
              {getStatusBadge(beach.status)}
            </div>
            <p className="text-gray-700">
              {beach.tempF !== undefined && `Water: ${beach.tempF}°F`}
              {beach.tempF !== undefined && beach.wave_height !== undefined && ' · '}
              {beach.wave_height !== undefined && `Waves: ${beach.wave_height} m`}
              {(beach.tempF !== undefined || beach.wave_height !== undefined) && beach.label && ' · '}
              {beach.label || ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
