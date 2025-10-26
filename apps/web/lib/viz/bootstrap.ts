import { deckAdapter } from "./adapters/deck";
import { echartsAdapter } from "./adapters/echarts";
import { mapLibreAdapter } from "./adapters/maplibre";
import { vegaLiteAdapter } from "./adapters/vegaLite";
import { visxAdapter } from "./adapters/visx";
import { registerAdapter } from "./registry";

registerAdapter("deck", deckAdapter);
registerAdapter("echarts", echartsAdapter);
registerAdapter("maplibre", mapLibreAdapter);
registerAdapter("vega", vegaLiteAdapter);
registerAdapter("visx", visxAdapter);
