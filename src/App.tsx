import { Canvas } from "./canvas/Canvas";
import { Toolbar } from "./toolbar/Toolbar";
import { NotificationToast } from "./components/NotificationToast";

export function App() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0a0f] text-zinc-100">
      <Toolbar />
      <Canvas />
      <NotificationToast />
    </div>
  );
}
