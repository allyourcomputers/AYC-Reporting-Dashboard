import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary">
        Halo Reporting v2
      </h1>
      <div className="mt-4 flex gap-2">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </div>
  )
}

export default App
