// Drawing data model and canvas rendering for the annotation layer.

export type Tool = 'pen' | 'highlighter' | 'eraser';

const TOOL_SETTINGS: Record<
  Tool,
  { alpha: number; widthFactor: number; composite: GlobalCompositeOperation }
> = {
  pen: { alpha: 1, widthFactor: 1, composite: 'source-over' },
  highlighter: { alpha: 0.35, widthFactor: 4, composite: 'source-over' },
  eraser: { alpha: 1, widthFactor: 4, composite: 'destination-out' },
};

export const isTool = (value: string | undefined): value is Tool =>
  value !== undefined && value in TOOL_SETTINGS;

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  tool: Tool;
  color: string;
  size: number;
  points: Point[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Draws strokes into a 2D context, inside the picture rectangle `rect` (canvas pixels). */
export function renderStrokes(g: CanvasRenderingContext2D, strokes: readonly Stroke[], rect: Rect): void {
  for (const stroke of strokes) {
    const tool = TOOL_SETTINGS[stroke.tool];
    g.save();
    g.globalCompositeOperation = tool.composite;
    g.globalAlpha = tool.alpha;
    g.strokeStyle = stroke.color;
    g.lineWidth = Math.max(1, stroke.size * tool.widthFactor * (rect.h / 600));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    stroke.points.forEach((p, i) => {
      const x = rect.x + p.x * rect.w;
      const y = rect.y + p.y * rect.h;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    const [first] = stroke.points;
    if (stroke.points.length === 1 && first) {
      g.lineTo(rect.x + first.x * rect.w + 0.01, rect.y + first.y * rect.h);
    }
    g.stroke();
    g.restore();
  }
}
