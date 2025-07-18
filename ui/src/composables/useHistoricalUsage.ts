import { ref, computed } from 'vue';

// Types for historical usage data
export interface HistoricalUsageRecord {
  timestamp: string;
  providerId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface HistoricalUsageResponse {
  records: HistoricalUsageRecord[];
}

// Aggregated data for sparklines
export interface SparklineData {
  timestamps: string[];
  costs: number[];
  tokens: number[];
  requests: number[];
}

export interface ProviderSparklineData {
  [providerId: string]: SparklineData;
}

export function useHistoricalUsage() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const rawData = ref<HistoricalUsageRecord[]>([]);

  const fetchHistoricalUsage = async (
    minutes: number = 60,
    model?: string,
    providerId?: string
  ) => {
    loading.value = true;
    error.value = null;

    try {
      const hours = minutes / 60; // Convert minutes to hours for the API
      const params = new URLSearchParams({
        hours: hours.toString(),
      });

      if (model) params.append('model', model);
      if (providerId) params.append('providerId', providerId);

      const url = `http://localhost:3000/usage/get?${params}`;
      console.log('Fetching historical usage from:', url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Historical usage data received:', data);

      // Handle both array format (direct from API) and object format (with records property)
      if (Array.isArray(data)) {
        rawData.value = data;
      } else if (data && data.records) {
        rawData.value = data.records;
      } else {
        rawData.value = [];
      }

    } catch (e: any) {
      error.value = e.message;
      console.error('Failed to fetch historical usage data:', e);
    } finally {
      loading.value = false;
    }
  };

  // Transform raw data into sparkline-friendly format with configurable aggregation
  const getSparklineData = (aggregationMinutes: number = 5): ProviderSparklineData => {
    const result: ProviderSparklineData = {};

    if (!rawData.value || rawData.value.length === 0) {
      return result;
    }

    // Group records by provider
    const groupedByProvider = rawData.value.reduce((acc, record) => {
      if (!acc[record.providerId]) {
        acc[record.providerId] = [];
      }
      acc[record.providerId].push(record);
      return acc;
    }, {} as { [key: string]: HistoricalUsageRecord[] });

    // Process each provider's data
    Object.entries(groupedByProvider).forEach(([providerId, records]) => {
      // Sort by timestamp
      const sortedRecords = records.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // For very short intervals (< 1 minute), use raw data points to avoid over-smoothing
      if (aggregationMinutes < 1) {
        result[providerId] = {
          timestamps: sortedRecords.map(r => r.timestamp),
          costs: sortedRecords.map(r => r.cost),
          tokens: sortedRecords.map(r => r.totalTokens),
          requests: sortedRecords.map(() => 1), // Each record represents 1 request
        };
      } else {
        // Create time buckets with configurable aggregation
        const buckets = aggregateByMinutes(sortedRecords, aggregationMinutes);

        result[providerId] = {
          timestamps: buckets.map(b => b.timestamp),
          costs: buckets.map(b => b.totalCost),
          tokens: buckets.map(b => b.totalTokens),
          requests: buckets.map(b => b.requestCount),
        };
      }
    });

    return result;
  };

  // Aggregate records by configurable minutes for sparklines (supports sub-minute intervals)
  const aggregateByMinutes = (records: HistoricalUsageRecord[], intervalMinutes: number) => {
    const buckets = new Map<string, {
      timestamp: string;
      totalCost: number;
      totalTokens: number;
      requestCount: number;
    }>();

    records.forEach(record => {
      // Convert interval to milliseconds for more precise bucketing
      const intervalMs = intervalMinutes * 60 * 1000;
      const recordTime = new Date(record.timestamp).getTime();

      // Round timestamp to the nearest interval
      const roundedTime = Math.floor(recordTime / intervalMs) * intervalMs;
      const bucketKey = new Date(roundedTime).toISOString();

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          timestamp: bucketKey,
          totalCost: 0,
          totalTokens: 0,
          requestCount: 0,
        });
      }

      const bucket = buckets.get(bucketKey)!;
      bucket.totalCost += record.cost;
      bucket.totalTokens += record.totalTokens;
      bucket.requestCount += 1;
    });

    return Array.from(buckets.values()).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  };

  // Get sparkline data for a specific provider with configurable aggregation
  const getProviderSparklineData = (providerId: string, aggregationMinutes: number = 5): SparklineData | null => {
    const data = getSparklineData(aggregationMinutes);
    return data[providerId] || null;
  };

  // Get all available provider IDs (reactive to rawData changes)
  const availableProviders = computed(() => {
    if (!rawData.value || rawData.value.length === 0) {
      return [];
    }

    const providerIds = new Set<string>();
    rawData.value.forEach(record => {
      providerIds.add(record.providerId);
    });

    return Array.from(providerIds);
  });

  return {
    loading,
    error,
    rawData,
    getSparklineData,
    fetchHistoricalUsage,
    getProviderSparklineData,
    availableProviders,
  };
}
