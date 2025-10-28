export interface MapboxOverlayProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export class MapboxOverlay {
  props: MapboxOverlayProps;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any | null = null;

  constructor(props: MapboxOverlayProps) {
    this.props = props;
  }

  setProps(props: MapboxOverlayProps) {
    this.props = props;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAdd(map: any) {
    this.map = map;
    if (map && typeof map.getCanvas === "function") {
      return map.getCanvas();
    }
    return document.createElement("div");
  }

  onRemove() {
    this.map = null;
  }

  finalize() {
    this.map = null;
  }
}

export default MapboxOverlay;
