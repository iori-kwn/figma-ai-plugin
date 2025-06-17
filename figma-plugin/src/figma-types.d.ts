// Figma API type definitions for plugin development
declare const figma: PluginAPI;
declare const __html__: string;

interface PluginAPI {
  createFrame(): FrameNode;
  createRectangle(): RectangleNode;
  createText(): TextNode;
  loadFontAsync(fontName: FontName): Promise<void>;
  showUI(html: string, options?: ShowUIOptions): void;
  closePlugin(): void;
  ui: UIAPI;
  currentPage: PageNode;
  viewport: ViewportAPI;
  clientStorage: ClientStorageAPI;
}

interface ShowUIOptions {
  width?: number;
  height?: number;
}

interface UIAPI {
  postMessage(message: any): void;
  onmessage: ((message: any) => void) | null;
}

interface ViewportAPI {
  scrollAndZoomIntoView(nodes: SceneNode[]): void;
}

interface ClientStorageAPI {
  getAsync(key: string): Promise<any>;
  setAsync(key: string, value: any): Promise<void>;
  keysAsync(): Promise<string[]>;
}

interface FontName {
  family: string;
  style: string;
}

interface SceneNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  resize(width: number, height: number): void;
  appendChild?(child: SceneNode): void;
}

interface FrameNode extends SceneNode {
  type: 'FRAME';
  fills: Paint[];
  appendChild(child: SceneNode): void;
}

interface RectangleNode extends SceneNode {
  type: 'RECTANGLE';
  fills: Paint[];
  cornerRadius: number;
}

interface TextNode extends SceneNode {
  type: 'TEXT';
  characters: string;
  fontSize: number;
  fills: Paint[];
}

interface PageNode {
  appendChild(child: SceneNode): void;
}

interface Paint {
  type: string;
  color: RGB;
  opacity?: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}