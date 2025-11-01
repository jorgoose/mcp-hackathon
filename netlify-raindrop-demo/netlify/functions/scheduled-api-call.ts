import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

/**
 * Scheduled function that runs every 5 minutes
 * This function will call the Chicago Data API and store results
 */
export default async () => {
  const timestamp = new Date().toISOString();

  try {
    console.log(`[${timestamp}] Scheduled function triggered`);

    // Call the Chicago Data Portal API
    const apiUrl = "https://data.cityofchicago.org/api/v3/views/qmqz-2xku/query.json";

    console.log(`[${timestamp}] Calling API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API call failed: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `API call failed: ${response.status}`,
          timestamp
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const data = await response.json();

    console.log(`[${timestamp}] API call successful`);

    // Store data in Netlify Blobs
    const store = getStore("chicago-data");
    await store.set("latest", JSON.stringify({
      timestamp,
      data
    }));

    // Also store with timestamp for history
    await store.set(`history-${timestamp}`, JSON.stringify(data));

    console.log(`[${timestamp}] Data stored in Netlify Blobs`);

    // Count records in response
    const recordCount = Array.isArray(data) ? data.length :
                       data.data?.length ||
                       Object.keys(data).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Chicago Data API call completed and stored successfully",
        timestamp,
        recordCount,
        dataPreview: JSON.stringify(data).substring(0, 200) + "..."
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error(`[${timestamp}] Error in scheduled function:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

// Configure the function to run every 5 minutes
// Cron syntax: "*/5 * * * *" means every 5 minutes
// Alternative syntax: "@every 5m"
export const config: Config = {
  schedule: "*/5 * * * *", // Run every 5 minutes
};