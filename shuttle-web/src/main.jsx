import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { setupFetchInterceptor } from './utils/authFetch'
import { loadNaverMap } from './map/naverMapLoader'

setupFetchInterceptor();

// 네이버 지도를 먼저 불러온 뒤 앱을 그린다 (키가 없거나 실패하면 OpenStreetMap 지도로 표시)
loadNaverMap().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
