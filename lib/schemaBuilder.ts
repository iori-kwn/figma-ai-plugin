// AIからのレスポンスをFigmaノードに変換するユーティリティ

// ノードタイプの定義
type NodeSchema = {
  type: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fills?: any[];
  children?: NodeSchema[];
  characters?: string;
  fontSize?: number;
  cornerRadius?: number;
};

/**
 * JSONスキーマからFigmaノードを生成する関数
 */
export function buildNodeTree(nodeSchemas: NodeSchema[]): SceneNode[] {
  const nodes: SceneNode[] = [];
  
  for (const schema of nodeSchemas) {
    const node = createNode(schema);
    if (node) {
      nodes.push(node);
    }
  }
  
  return nodes;
}

/**
 * 単一のノードを生成する関数
 */
function createNode(schema: NodeSchema): SceneNode | null {
  let node: SceneNode | null = null;
  
  // ノードタイプに基づいてFigmaノードを作成
  switch (schema.type) {
    case 'FRAME':
      node = figma.createFrame();
      break;
    case 'RECTANGLE':
      node = figma.createRectangle();
      break;
    case 'TEXT':
      node = figma.createText();
      if (schema.characters) {
        // フォントをロード（非同期操作だが、簡略化のため同期的に処理）
        // 実際の実装では非同期処理が必要
        (node as TextNode).characters = schema.characters;
        
        if (schema.fontSize) {
          (node as TextNode).fontSize = schema.fontSize;
        }
      }
      break;
    default:
      console.warn(`Unsupported node type: ${schema.type}`);
      return null;
  }
  
  // 共通プロパティを設定
  if (schema.name) {
    node.name = schema.name;
  }
  
  if (schema.x !== undefined) {
    node.x = schema.x;
  }
  
  if (schema.y !== undefined) {
    node.y = schema.y;
  }
  
  if (schema.width !== undefined && 'resize' in node) {
    if (schema.height !== undefined) {
      node.resize(schema.width, schema.height);
    } else {
      node.resize(schema.width, node.height);
    }
  }
  
  if (schema.fills && 'fills' in node) {
    // Figmaの塗りつぶしプロパティの設定
    node.fills = schema.fills as Paint[];
  }
  
  if (schema.cornerRadius !== undefined && 'cornerRadius' in node) {
    node.cornerRadius = schema.cornerRadius;
  }
  
  // 子ノードを再帰的に処理（Frameなどのコンテナノードの場合）
  if (schema.children && 'appendChild' in node) {
    const childNodes = buildNodeTree(schema.children);
    for (const childNode of childNodes) {
      node.appendChild(childNode);
    }
  }
  
  return node;
}
