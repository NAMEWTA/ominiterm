import { Canvas } from "./canvas/Canvas";
import { Toolbar } from "./toolbar/Toolbar";
import { NotificationToast } from "./components/NotificationToast";

export function App() {
  return (
    <>
      <Toolbar />
      <div className="pt-10 h-screen">
        <Canvas />
      </div>
      <NotificationToast />
    </>
  );
}
