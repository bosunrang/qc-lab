type CanvasLike=Element&{_ljDraw?:()=>void;getBoundingClientRect:()=>{width:number}};
type Observer={observe:(target:Element)=>void;disconnect:()=>void};

export function createVisibleCanvasService(deps:{requestFrame:(work:()=>void)=>unknown;intersectionObserver?:(onVisible:()=>void)=>Observer;resizeObserver?:(onResize:()=>void)=>Observer;isConnected:(canvas:CanvasLike)=>boolean}){
  let observers:Observer[]=[];
  let queue=new Set<CanvasLike>(),frame:unknown=null;
  const queueCanvasDraw=(canvas:CanvasLike|null|undefined)=>{if(!canvas||!canvas._ljDraw)return;queue.add(canvas);if(frame!==null)return;frame=deps.requestFrame(()=>{frame=null;const pending=[...queue];queue.clear();pending.forEach(item=>{if(deps.isConnected(item)&&item._ljDraw)item._ljDraw();});});};
  const drawVisibleCanvas=(canvas:CanvasLike,draw:()=>void)=>{canvas._ljDraw=draw;const run=()=>queueCanvasDraw(canvas);if(deps.intersectionObserver){const observer=deps.intersectionObserver(run);observer.observe(canvas);observers.push(observer);}else run();if(deps.resizeObserver){let lastWidth=0;const observer=deps.resizeObserver(()=>{const width=Math.round(canvas.getBoundingClientRect().width);if(width>0&&width!==lastWidth){lastWidth=width;run();}});observer.observe(canvas);observers.push(observer);}};
  const disconnectObservers=()=>{observers.forEach(observer=>observer.disconnect());observers=[];};
  return{queueCanvasDraw,drawVisibleCanvas,disconnectObservers};
}
