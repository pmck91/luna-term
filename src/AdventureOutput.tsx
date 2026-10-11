import type { AdventureLine } from '../shared/adventure';

export function AdventureOutput({ lines }: { lines: AdventureLine[] }) {
  return <div className="adventure-output">{lines.map((line, i) => line.map
    ? <pre className="adventure-map" key={i} aria-label="Map of Peter's house">{line.text}</pre>
    : <div className={`adventure-line ${line.tone === 'heading' ? 'accent adventure-heading' : line.tone || ''}`} key={i}>{line.text}</div>)}</div>;
}
