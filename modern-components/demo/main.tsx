import React from 'react'
import ReactDOM from 'react-dom/client'
import { ComponentDemo } from './ComponentDemo'
import '../src/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ComponentDemo />
  </React.StrictMode>,
)