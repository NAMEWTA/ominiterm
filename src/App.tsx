import { Canvas } from "./canvas/Canvas";
import { Toolbar } from "./toolbar/Toolbar";
import { Sidebar } from "./components/Sidebar";
import { NotificationToast } from "./components/NotificationToast";

export function App() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0a0a] text-[#ededed]">
      <Toolbar />
      <Sidebar />
      <Canvas />
      <NotificationToast />
    </div>
  );
}
