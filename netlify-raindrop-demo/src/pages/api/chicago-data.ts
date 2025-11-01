import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
    const timestamp = new Date().toISOString();

    try {
        // Call the Chicago Data Portal API directly
        const apiUrl = "https://data.cityofchicago.org/resource/qmqz-2xku.json";

        console.log(`[${timestamp}] Fetching data from Chicago API`);

        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Chicago API call failed: ${response.status} - ${errorText}`);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `API call failed: ${response.status}`,
                    timestamp
                }),
                {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        const data = await response.json();

        console.log(`[${timestamp}] Chicago API call successful`);

        return new Response(
            JSON.stringify({
                success: true,
                timestamp,
                data
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    } catch (error) {
        console.error(`[${timestamp}] Error fetching Chicago data:`, error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
};
