import { Editor } from "@/components/app/Editor"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"

export function App() {
  return (
    <TooltipProvider delay={350} closeDelay={80}>
      <Toaster>
        <Editor />
      </Toaster>
    </TooltipProvider>
  )
}
