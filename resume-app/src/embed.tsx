import { createRoot, type Root } from 'react-dom/client';
import './globals.css';
import ResumeBuilderRoot from './ResumeBuilderRoot';

let rootInst: Root | null = null;
let mountedEl: HTMLElement | null = null;

function mountResumeBuilder(container: HTMLElement) {
  if (mountedEl !== container && rootInst) {
    rootInst.unmount();
    rootInst = null;
  }
  mountedEl = container;
  rootInst = createRoot(container);
  rootInst.render(
    <div className="resume-app-scope">
      <ResumeBuilderRoot />
    </div>
  );
}

function unmountResumeBuilder() {
  if (!rootInst) return;
  rootInst.unmount();
  rootInst = null;
  mountedEl = null;
}

declare global {
  interface Window {
    mountResumeBuilder?: typeof mountResumeBuilder;
    unmountResumeBuilder?: typeof unmountResumeBuilder;
  }
}

window.mountResumeBuilder = mountResumeBuilder;
window.unmountResumeBuilder = unmountResumeBuilder;

export { mountResumeBuilder, unmountResumeBuilder };
