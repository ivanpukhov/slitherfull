import { forwardRef } from 'react'

export const Minimap = forwardRef<HTMLCanvasElement>(function Minimap(_, ref) {
  return (
    <div id="minimapPanel" className="panel">
      <div className="title">Карта</div>
      <canvas id="minimapCanvas" width={188} height={188} ref={ref} />
    </div>
  )
})
