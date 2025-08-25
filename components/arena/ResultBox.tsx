export default function ResultBox({ text }: { text: string | null }) {
  if (!text) return null
  return <div className="mt-4 p-3 rounded-xl border bg-gray-50">{text}</div>
}
