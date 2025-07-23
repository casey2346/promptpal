import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

export function setupOpenTelemetry() {
  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'promptpal-backend',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  try {
    sdk.start();
    console.log('✅ OpenTelemetry SDK started');
  } catch (error) {
    console.error('❌ Error starting OpenTelemetry SDK', error);
  }
}

export async function shutdownTracing() {
  if (sdk) {
    await sdk.shutdown();
    console.log('🛑 OpenTelemetry SDK shut down');
  }
}
