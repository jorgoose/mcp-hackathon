import { useState, useEffect } from 'react';

interface ChicagoDataResponse {
    success: boolean;
    timestamp?: string;
    data?: any;
    message?: string;
}

export default function ChicagoDataDisplay() {
    const [data, setData] = useState<ChicagoDataResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/chicago-data');
            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [autoRefresh]);

    const formatTimestamp = (timestamp?: string) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div className="max-w-6xl mx-auto">
            {/* Controls */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Loading...' : 'Refresh Data'}
                    </button>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="rounded"
                        />
                        Auto-refresh (30s)
                    </label>
                </div>
                {data?.timestamp && (
                    <div className="text-sm text-gray-500">
                        Last updated: {formatTimestamp(data.timestamp)}
                    </div>
                )}
            </div>

            {/* Loading State */}
            {loading && !data && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading Chicago data...</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800">
                        <strong>Error:</strong> {error}
                    </p>
                </div>
            )}

            {/* No Data State */}
            {!loading && data && !data.success && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <p className="text-yellow-800">
                        {data.message || 'No data available yet.'}
                    </p>
                    <p className="text-sm text-yellow-700 mt-2">
                        The scheduled function runs every 5 minutes and will populate data automatically.
                    </p>
                </div>
            )}

            {/* Data Display */}
            {!loading && data?.success && data.data && (
                <div className="space-y-6">
                    {/* Summary Card */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            Chicago Data Portal - Live Data
                        </h2>
                        <p className="text-gray-600">
                            This data is automatically fetched every 5 minutes from the City of Chicago Data Portal
                        </p>
                    </div>

                    {/* Data Content */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold mb-4">Data Response</h3>
                        <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-[600px]">
                            <pre className="text-sm text-gray-800">
                                {JSON.stringify(data.data, null, 2)}
                            </pre>
                        </div>
                    </div>

                    {/* Metadata */}
                    {data.data && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                <div className="text-sm text-gray-500 mb-1">Data Type</div>
                                <div className="text-lg font-semibold">
                                    {Array.isArray(data.data) ? 'Array' : typeof data.data}
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                <div className="text-sm text-gray-500 mb-1">Record Count</div>
                                <div className="text-lg font-semibold">
                                    {Array.isArray(data.data)
                                        ? data.data.length
                                        : Object.keys(data.data).length}
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                <div className="text-sm text-gray-500 mb-1">Last Fetch</div>
                                <div className="text-lg font-semibold">
                                    {formatTimestamp(data.timestamp)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
