import type { APIRoute } from 'astro';

export const prerender = false;

interface BeachData {
  beach_name: string;
  measurement_timestamp: string;
  water_temperature: string;
  wave_height: string;
  measurement_timestamp_label: string;
}

interface ProcessedBeachData {
  beach_name: string;
  status: 'good' | 'caution' | 'no_swim' | 'stale';
  tempF?: number;
  wave_height?: number;
  last_updated: string;
  label: string;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get the date from query parameters or use default (September 9th, 2024)
    const url = new URL(request.url);
    const defaultDate = "2024-09-09"; // September 9th, 2024
    
    // Allow selecting a specific start date via query parameter
    const startDate = url.searchParams.get('startDate') || defaultDate;
    
    // Calculate an end date to create a date range (default to current date)
    const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    console.log(`[API] Request received with params:`, Object.fromEntries(url.searchParams));
    console.log(`[API] Using date range: ${startDate} to ${endDate}`);
    
    // Use the API v3 endpoint as specified in the documentation
    const apiUrl = new URL('https://data.cityofchicago.org/api/v3/views/qmqz-2xku/query.json');
    
    // Add pagination parameters
    apiUrl.searchParams.append('pageNumber', '1');
    apiUrl.searchParams.append('pageSize', '1000');
    
    // Add app token to increase rate limits
    const appToken = import.meta.env.CHICAGO_DATA_APP_TOKEN;
    console.log('[API] Chicago Data API Token available:', appToken ? 'Yes' : 'No');
    
    if (appToken) {
      apiUrl.searchParams.append('app_token', appToken);
    } else {
      console.warn('[API] No CHICAGO_DATA_APP_TOKEN found in environment variables. API rate limits may be restricted.');
    }
    
    const startTime = Date.now();
    console.log(`[API] Request started at: ${new Date().toISOString()}`);
    
    // Following the exact format from the API docs, using POST with JSON body
    const response = await fetch(apiUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': appToken || ''
      },
      body: JSON.stringify({
        query: `SELECT beach_name, measurement_timestamp, water_temperature, wave_height, measurement_timestamp_label 
                WHERE measurement_timestamp >= '${startDate}' 
                AND measurement_timestamp <= '${endDate}'
                AND water_temperature IS NOT NULL 
                AND wave_height IS NOT NULL
                ORDER BY measurement_timestamp DESC`,
        page: {
          pageNumber: 1,
          pageSize: 1000
        },
        includeSynthetic: false
      })
    });
    
    const endTime = Date.now();
    console.log(`[API] Request completed in ${endTime - startTime}ms with status: ${response.status}`);
    
    // Log response headers for debugging
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('[API] Response headers:', headers);
    
    if (!response.ok) {
      // Try to get more details about the error
      let errorDetails = '';
      try {
        const errorText = await response.text();
        errorDetails = ` - ${errorText}`;
      } catch (e) {
        // Ignore error reading response body
      }
      
      throw new Error(`Failed to fetch beach data: ${response.status} ${response.statusText}${errorDetails}`);
    }
    
    const responseData = await response.json();
    
    // Log the raw response structure to understand what we're getting
    console.log('[API] Response structure type:', typeof responseData);
    console.log('[API] Is array?', Array.isArray(responseData));
    
    if (typeof responseData === 'object' && responseData !== null) {
      console.log('[API] Response keys:', Object.keys(responseData));
    }
    
    // Extract the data from the API v3 response format
    let data: BeachData[] = [];
    
    // Based on the API docs and example, the response should have a 'data' property
    if (responseData && responseData.data && Array.isArray(responseData.data)) {
      console.log(`[API] Found data array with ${responseData.data.length} items`);
      data = responseData.data as BeachData[];
    } else if (responseData && responseData.rows && Array.isArray(responseData.rows)) {
      console.log(`[API] Found rows array with ${responseData.rows.length} items`);
      
      // Get column information
      if (responseData.columns && Array.isArray(responseData.columns)) {
        console.log('[API] Found columns array with column definitions');
        
        // Map column names to their indices
        const columnMap: Record<string, number> = {};
        responseData.columns.forEach((column: any, index: number) => {
          const columnName = column.fieldName || column.name;
          if (columnName) {
            columnMap[columnName] = index;
          }
        });
        
        console.log('[API] Column mapping:', columnMap);
        
        // Process each row using the column mapping
        responseData.rows.forEach((row: any[]) => {
          const beachData: any = {};
          
          // Map the values from the row to named fields
          Object.entries(columnMap).forEach(([fieldName, index]) => {
            beachData[fieldName] = row[index];
          });
          
          // Only add if we have the required fields
          if (beachData.beach_name && beachData.measurement_timestamp) {
            data.push(beachData as BeachData);
          }
        });
      } else {
        console.warn('[API] Missing columns definition in response');
      }
    } else if (Array.isArray(responseData)) {
      // Direct array response
      console.log('[API] Response is a direct array');
      data = responseData as BeachData[];
    } else {
      console.warn('[API] Unexpected response format');
    }
    
    console.log(`[API] Processed ${data.length} beach records from API response`);
    
    // Log some sample data for debugging
    if (data.length > 0) {
      console.log('[API] Sample record:', JSON.stringify(data[0], null, 2));
      
      // Log available fields in the data
      const fields = Object.keys(data[0]);
      console.log('[API] Available fields:', fields);
    }
    
    // If no data is returned, provide a fallback
    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [],
          message: "No beach data available for the requested time period"
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('[API] Starting data processing and grouping');
    console.log(`[API] Processing ${data.length} records for unique beaches`);
    
    // Group by beach_name, keeping only the most recent record for each beach
    const beachMap = new Map<string, BeachData>();
    const beachStats = {};
    
    for (const record of data) {
      // Keep track of records per beach for logging
      beachStats[record.beach_name] = (beachStats[record.beach_name] || 0) + 1;
      
      const existingRecord = beachMap.get(record.beach_name);
      
      if (!existingRecord || new Date(record.measurement_timestamp) > new Date(existingRecord.measurement_timestamp)) {
        beachMap.set(record.beach_name, record);
      }
    }
    
    console.log(`[API] Found ${beachMap.size} unique beaches`);
    console.log('[API] Records per beach:', beachStats);
    
    const now = new Date();
    
    console.log('[API] Starting data processing for each beach');
    
    // Process each beach record
    const processedData: ProcessedBeachData[] = Array.from(beachMap.values()).map(beach => {
      console.log(`[API] Processing beach: ${beach.beach_name}`);
      
      // Parse numeric fields, with fallbacks for missing data
      const waterTemp = beach.water_temperature ? parseFloat(beach.water_temperature) : undefined;
      const waveHeight = beach.wave_height ? parseFloat(beach.wave_height) : undefined;
      
      console.log(`[API] ${beach.beach_name} - Raw values: water_temp=${beach.water_temperature}, wave_height=${beach.wave_height}`);
      console.log(`[API] ${beach.beach_name} - Parsed values: waterTemp=${waterTemp}, waveHeight=${waveHeight}`);
      
      // Compute derived fields
      const tempF = waterTemp !== undefined ? (waterTemp * 9/5) + 32 : undefined;
      const measurementTime = new Date(beach.measurement_timestamp);
      const hoursOld = (now.getTime() - measurementTime.getTime()) / 3600000;
      
      console.log(`[API] ${beach.beach_name} - Computed values: tempF=${tempF?.toFixed(1)}°F, timestamp=${measurementTime.toISOString()}, hoursOld=${hoursOld.toFixed(1)}`);
      
      // Apply rule logic
      let status: 'good' | 'caution' | 'no_swim' | 'stale' = 'good';
      let statusReason = '';
      
      if (hoursOld > 3) {
        status = 'stale';
        statusReason = `Data is ${hoursOld.toFixed(1)} hours old (> 3 hours)`;
      } else if (waveHeight !== undefined && waveHeight >= 0.6) {
        status = 'no_swim';
        statusReason = `Wave height ${waveHeight}m is >= 0.6m`;
      } else if (waveHeight !== undefined && waveHeight >= 0.3) {
        status = 'caution';
        statusReason = `Wave height ${waveHeight}m is >= 0.3m`;
      } else if (tempF !== undefined && tempF < 60) {
        status = 'caution';
        statusReason = `Water temperature ${tempF.toFixed(1)}°F is < 60°F`;
      } else {
        statusReason = 'All measurements within safe ranges';
      }
      
      console.log(`[API] ${beach.beach_name} - Status: ${status} - Reason: ${statusReason}`);
      
      // Format the label
      let label: string;
      if (hoursOld < 1) {
        label = `Updated ${Math.round(hoursOld * 60)} min ago`;
      } else {
        label = `Updated ${Math.round(hoursOld)} hr${hoursOld >= 2 ? 's' : ''} ago`;
      }
      
      return {
        beach_name: beach.beach_name,
        status,
        tempF: tempF !== undefined ? Math.round(tempF * 10) / 10 : undefined, // Round to 1 decimal place if available
        wave_height: waveHeight,
        last_updated: beach.measurement_timestamp,
        label
      };
    });
    
    // Sort beaches alphabetically by name
    processedData.sort((a, b) => a.beach_name.localeCompare(b.beach_name));
    
    console.log(`[API] Finished processing ${processedData.length} beaches`);
    console.log('[API] Status summary:', processedData.reduce((acc, beach) => {
      acc[beach.status] = (acc[beach.status] || 0) + 1;
      return acc;
    }, {}));
    
    const finalResponse = {
      success: true,
      data: processedData,
      metadata: {
        requestDate: new Date().toISOString(),
        dateRange: {
          start: startDate,
          end: endDate
        },
        beachCount: processedData.length,
        processingTimeMs: Date.now() - startTime
      }
    };
    
    console.log('[API] Sending response with metadata:', finalResponse.metadata);
    
    return new Response(
      JSON.stringify(finalResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error fetching beach data:', error);
    
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