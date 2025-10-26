export class Map {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public readonly options: any) {}
  getStyle() {
    return { sprite: this.options?.style };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setStyle(style: any, opts?: unknown) {
    void style;
    void opts;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setCenter(center: any) {
    void center;
  }
  setZoom(zoom: number) {
    void zoom;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPitch(pitch: number, opts?: unknown) {
    void pitch;
    void opts;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setBearing(bearing: number, opts?: unknown) {
    void bearing;
    void opts;
  }
  remove() {}
}
