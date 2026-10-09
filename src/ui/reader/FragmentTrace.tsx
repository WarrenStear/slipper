import type {CSSProperties} from 'react';
import {resolveFragmentTrace,type FragmentTraceInput} from './fragmentTracePresentation';
import './FragmentTrace.css';

/** Anonymous decoration underneath an already admitted reader. The DOM cannot expose metadata. */
export function FragmentTrace(props:FragmentTraceInput) {
  const trace=resolveFragmentTrace(props);
  if (!trace) return null;
  return <span aria-hidden="true" className={`fragment-trace fragment-trace--${trace.family}`}
    data-fragment-trace={trace.family} data-trace-motion={trace.motion?'gentle':'static'}
    style={{'--fragment-trace-ground':trace.ground,'--fragment-trace-light':trace.light}as CSSProperties} />;
}
