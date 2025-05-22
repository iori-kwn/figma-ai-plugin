// AIからのレスポンスをFigmaノードに変換するユーティリティ
/**
 * JSONスキーマからFigmaノードを生成する関数
 */
export function buildNodeTree(nodeSchemas) {
    const nodes = [];
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
function createNode(schema) {
    let node = null;
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
                node.characters = schema.characters;
                if (schema.fontSize) {
                    node.fontSize = schema.fontSize;
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
        }
        else {
            node.resize(schema.width, node.height);
        }
    }
    if (schema.fills && 'fills' in node) {
        // Figmaの塗りつぶしプロパティの設定
        node.fills = schema.fills;
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
