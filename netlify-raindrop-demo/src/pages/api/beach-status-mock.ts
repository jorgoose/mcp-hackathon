import type { APIRoute } from 'astro';

export const prerender = false;

interface ProcessedBeachData {
  beach_name: string;
  status: 'good' | 'caution' | 'no_swim' | 'stale';
  tempF?: number;
  wave_height?: number;
  last_updated: string;
  label: string;
}

// Mock beach data generator
const generateMockBeachData = (date: string): ProcessedBeachData[] => {
  // List of beach names from sensor data
  const beachNames = [
    "63rd Street Beach",
    "Calumet Beach",
    "Montrose Beach",
    "Ohio Street Beach",
    "Osterman Beach",
    "Rainbow Beach"
  ];
  
  // Parse the requested date
  const requestDate = new Date(date);
  const now = new Date();
  
  // Set the requested date time to current time for "last updated" calculations
  requestDate.setHours(now.getHours());
  requestDate.setMinutes(now.getMinutes());
  
  // Generate a seed based on the date to get consistent results for the same date
  const dateSeed = requestDate.getTime();
  
  // Simple pseudo-random number generator with seed
  const seededRandom = (min: number, max: number, seed: number) => {
    const x = Math.sin(seed) * 10000;
    const rand = x - Math.floor(x);
    return min + rand * (max - min);
  };
  
  return beachNames.map((beachName, index) => {
    // Generate consistent values based on beach index and date
    const seed = dateSeed + index * 1000;
    
    // Generate water temperature between 55°F and 75°F
    const tempF = Math.round(seededRandom(55, 75, seed) * 10) / 10;
    
    // Generate wave height between 0.1m and 0.8m
    const wave_height = Math.round(seededRandom(0.1, 0.8, seed + 1) * 100) / 100;
    
    // Calculate hours since last update (between 0 and 5 hours)
    const hoursOld = Math.round(seededRandom(0, 5, seed + 2) * 10) / 10;
    
    // Determine status based on the same rules as the real data
    let status: 'good' | 'caution' | 'no_swim' | 'stale' = 'good';
    
    if (hoursOld > 3) {
      status = 'stale';
    } else if (wave_height >= 0.6) {
      status = 'no_swim';
    } else if (wave_height >= 0.3) {
      status = 'caution';
    } else if (tempF < 60) {
      status = 'caution';
    }
    
    // Format the label
    let label: string;
    if (hoursOld < 1) {
      label = `Updated ${Math.round(hoursOld * 60)} min ago`;
    } else {
      label = `Updated ${Math.round(hoursOld)} hr${hoursOld >= 2 ? 's' : ''} ago`;
    }
    
    // Calculate the last updated timestamp
    const lastUpdated = new Date(now.getTime() - hoursOld * 60 * 60 * 1000);
    
    return {
      beach_name: beachName,
      status,
      tempF,
      wave_height,
      last_updated: lastUpdated.toISOString(),
      label
    };
  });
};

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get the date from query parameters or use current date
    const url = new URL(request.url);
    const today = new Date().toISOString().split('T')[0];
    const startDate = url.searchParams.get('startDate') || today;
    
    console.log(`[MOCK API] Request received with params:`, Object.fromEntries(url.searchParams));
    console.log(`[MOCK API] Using start date: ${startDate}`);
    
    const startTime = Date.now();
    
    // Generate mock beach data
    const mockData = generateMockBeachData(startDate);
    
    // Sort beaches alphabetically by name
    mockData.sort((a, b) => a.beach_name.localeCompare(b.beach_name));
    
    console.log(`[MOCK API] Generated ${mockData.length} mock beach records`);
    
    const finalResponse = {
      success: true,
      data: mockData,
      metadata: {
        requestDate: new Date().toISOString(),
        startDate,
        beachCount: mockData.length,
        processingTimeMs: Date.now() - startTime,
        isMockData: true
      }
    };
    
    console.log('[MOCK API] Sending response with metadata:', finalResponse.metadata);
    
    return new Response(
      JSON.stringify(finalResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error generating mock beach data:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
