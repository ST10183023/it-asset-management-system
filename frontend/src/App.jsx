import { useEffect, useMemo, useRef, useState } from 'react'
import { createWorker } from 'tesseract.js'
import './App.css'

const API_URL = 'http://localhost:5000/api/assets'

const emptyAsset = { name: '', category: 'Chromebook', assignedTo: '', location: '', status: 'Available' }
const navItems = [
  { id: 'overview', icon: '⌂', label: 'Overview' },
  { id: 'inventory', icon: '▤', label: 'Asset inventory' },
  { id: 'audits', icon: '✓', label: 'Audits' },
  { id: 'maintenance', icon: '⚙', label: 'Maintenance' },
]

function App() {
  const [assets, setAssets] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [activePage, setActivePage] = useState('overview')
  const [showForm, setShowForm] = useState(false)
  const [newAsset, setNewAsset] = useState(emptyAsset)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [detectedSerial, setDetectedSerial] = useState('')
  const [scanMessage, setScanMessage] = useState('')
  const [scannedSerials, setScannedSerials] = useState([])
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  async function loadAssets() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(API_URL)
      if (!response.ok) throw new Error('Could not load assets from the server.')
      const data = await response.json()
      setAssets(Array.isArray(data) ? data : [])
    } catch {
      setError('Unable to load assets. Check that your backend is running on port 5000.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAssets() }, [])

  const filteredAssets = useMemo(() => assets.filter((asset) => {
    const searchable = [asset.assetTag, asset._id, asset.name, asset.category, asset.assignedTo, asset.location, asset.serialNumber]
      .filter(Boolean).join(' ').toLowerCase()
    const matchesPage = activePage !== 'maintenance' || asset.status === 'Maintenance'
    return searchable.includes(search.toLowerCase()) && (filter === 'All' || asset.status === filter) && matchesPage
  }), [assets, search, filter, activePage])

  const assigned = assets.filter((a) => a.status === 'Assigned').length
  const available = assets.filter((a) => a.status === 'Available').length
  const maintenance = assets.filter((a) => a.status === 'Maintenance').length

  async function addAsset(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAsset),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save the asset.')
      setAssets((current) => [data.asset, ...current])
      setNewAsset({ ...emptyAsset })
      setShowForm(false)
      setActivePage('inventory')
      setFilter('All')
      setSuccess('Asset registered successfully.')
    } catch (err) {
      setError(err.message || 'Could not save the asset. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function startCamera() {
    setCameraError('')
    setCameraReady(false)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access needs HTTPS or localhost. Open this page in a supported browser.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
      }
    } catch (err) {
      setCameraError(err.message || 'Could not access the camera. Check browser permissions.')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraReady(false)
  }

  useEffect(() => {
    if (scannerOpen) startCamera()
    else stopCamera()
    return () => stopCamera()
  }, [scannerOpen])

  async function captureAndReadSerial() {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setCameraError('The camera is not ready yet. Please wait a moment and try again.')
      return
    }
    setOcrBusy(true)
    setCameraError('')
    setScanMessage('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d')
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const image = canvas.toDataURL('image/jpeg', 0.92)
      const worker = await createWorker('eng')
      const result = await worker.recognize(image)
      await worker.terminate()
     
const text = result.data.text || ''

const lines = text
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

// Prioritise the line containing the serial number label.
const serialLine = lines.find((line) =>
  /S\s*\/?\s*N|SERIAL\s*(NO\.?|NUMBER)?/i.test(line)
)

let candidate = ''

if (serialLine) {
  const match = serialLine.match(
    /(?:S\s*\/?\s*N|SERIAL\s*(?:NO\.?|NUMBER)?)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9-]{5,})/i
  )

  if (match) {
    candidate = match[1]
  }
}

if (!candidate) {
  candidate = text.trim()
}

const cleanedSerial = candidate
  .replace(/\s+/g, '')
  .replace(/[^a-zA-Z0-9_-]/g, '')
  .toUpperCase()

setDetectedSerial(cleanedSerial)

      setScanMessage(text ? 'Text detected. Please verify every character before adding it.' : 'No readable text found. Move closer, improve lighting and try again.')
    } catch (err) {
      setCameraError('Could not read the image. Try again with the label in focus and good lighting.')
    } finally {
      setOcrBusy(false)
    }
  }

  function confirmSerialScan() {
    const serial = detectedSerial.trim().toUpperCase()
    if (!serial) {
      setScanMessage('Enter or correct the serial number before confirming.')
      return
    }
    if (scannedSerials.includes(serial)) {
      setScanMessage(`Duplicate scan: ${serial} has already been scanned in this session.`)
      return
    }
    const match = assets.find((asset) =>
      String(asset.serialNumber || asset.serial || '').trim().toUpperCase() === serial
    )
    setScannedSerials((current) => [...current, serial])
    setScanMessage(match
      ? `Matched registered asset: ${match.name || 'Unnamed asset'}. Recorded in this browser session.`
      : 'No matching serial number found in the current inventory. Recorded as not matched for this browser session.')
    setDetectedSerial('')
  }

  const pageTitle = {
    overview: 'Welcome to AssetFlow',
    inventory: 'Asset inventory',
    audits: 'Asset audits',
    maintenance: 'Maintenance',
  }[activePage]

  return (
    <div className="app-shell">
      {mobileMenuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon">A</div>
          <div className="brand-copy"><strong>AssetFlow</strong><span>NOVA PIONEER RUIMSIG</span></div>
        </div>
        <p className="nav-heading">WORKSPACE</p>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${activePage === item.id ? 'active' : ''}`} onClick={() => {
              setActivePage(item.id); setMobileMenuOpen(false); setError(''); setSuccess('')
              setFilter(item.id === 'maintenance' ? 'Maintenance' : 'All')
            }}>
              <span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span>
              {item.id === 'audits' && <span className="nav-soon">NEXT</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note"><span className="sidebar-note-icon">✦</span><div><strong>Built for your campus</strong><p>Inventory, audits and device care in one place.</p></div></div>
        <div className="sidebar-bottom"><div className="profile-avatar">IT</div><div><strong>IT Administrator</strong><span>Ruimsig Campus</span></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <button className="mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">☰</button>
            <div><span className="eyebrow">NOVA PIONEER / RUIMSIG</span><h1>{pageTitle}</h1></div>
          </div>
          <div className="topbar-actions">
            <span className="connection-pill"><span className="connection-dot" /> Database connected</span>
            <button className="secondary-button scan-launch" onClick={() => { setScannerOpen(true); setCameraError(''); setScanMessage('') }}>◎ Scan serial</button><button className="primary-button" onClick={() => { setShowForm((v) => !v); setError(''); setSuccess('') }}><span aria-hidden="true">＋</span> Register asset</button>
          </div>
        </header>

        {activePage === 'overview' && <>
          <section className="welcome-panel">
            <div className="welcome-copy"><span className="welcome-tag">RUIMSIG IT OPERATIONS</span><h2>Your campus equipment.<br />Clear, organised, accounted for.</h2><p>A simpler way to manage devices, track assets and prepare for your next physical audit.</p>
              <div className="welcome-actions"><button className="light-button" onClick={() => setActivePage('inventory')}>View inventory <span>→</span></button><button className="outline-light-button" onClick={() => setActivePage('audits')}>Plan an audit</button></div>
            </div>
            <div className="welcome-graphic" aria-hidden="true"><div className="graphic-circle circle-one" /><div className="graphic-circle circle-two" /><div className="graphic-device"><span>✓</span><i /><i /><i /></div><div className="graphic-label">ASSETFLOW <b>•</b> RUIMSIG</div></div>
          </section>
          <section className="section-heading"><div><span className="eyebrow">AT A GLANCE</span><h2>Inventory overview</h2></div><button className="text-button" onClick={() => setActivePage('inventory')}>See all assets <span>→</span></button></section>
          <section className="stats-grid">
            <StatCard label="Total assets" value={assets.length} detail="Registered in AssetFlow" icon="▤" tone="blue" />
            <StatCard label="Assigned" value={assigned} detail="Currently in use" icon="↗" tone="purple" />
            <StatCard label="Available" value={available} detail="Ready to be issued" icon="✓" tone="green" />
            <StatCard label="Maintenance" value={maintenance} detail="Needs attention" icon="⚙" tone="orange" />
          </section>
          <section className="quick-actions"><div className="section-heading compact-heading"><div><span className="eyebrow">QUICK ACCESS</span><h2>Where do you want to go?</h2></div></div>
            <div className="quick-grid">
              <QuickCard icon="▤" title="All assets" description="Search and manage registered equipment." action="Open inventory" onClick={() => setActivePage('inventory')} tone="blue" />
              <QuickCard icon="✓" title="Physical audits" description="Scan devices and reconcile what is on site." action="Audit workspace" onClick={() => setActivePage('audits')} tone="green" />
              <QuickCard icon="⚙" title="Maintenance" description="Review equipment that needs attention." action="View maintenance" onClick={() => { setActivePage('maintenance'); setFilter('Maintenance') }} tone="orange" />
            </div>
          </section>
        </>}

        {activePage === 'audits' && <section className="feature-intro">
          <div className="feature-icon green-icon">✓</div><span className="eyebrow">AUDIT WORKSPACE</span><h2>Make physical audits faster.</h2>
          <p>The audit workspace will let you select a school and device group, scan serial numbers continuously, mark registered devices as physically verified, and flag missing, new or duplicate devices.</p>
          <div className="feature-steps"><div><span>01</span><strong>Select audit area</strong><small>Primary, High School or shared assets</small></div><div><span>02</span><strong>Scan devices</strong><small>Barcode, QR code or camera text recognition</small></div><div><span>03</span><strong>Review results</strong><small>Missing assets, new devices and discrepancies</small></div></div>
          <p className="feature-note">This is a design placeholder. Audit records and scanning are not implemented yet.</p>
          <button className="primary-button" onClick={() => setActivePage('inventory')}>Review current inventory <span>→</span></button>
        </section>}

        {activePage === 'maintenance' && <section className="feature-intro maintenance-intro"><div className="feature-icon orange-icon">⚙</div><span className="eyebrow">DEVICE CARE</span><h2>Maintenance queue</h2><p>Assets marked as Maintenance appear in the list below. Later, we can add repair notes, damage photos, supplier details and repair history.</p></section>}

        {activePage === 'inventory' && <section className="inventory-intro"><div><span className="eyebrow">REGISTERED EQUIPMENT</span><h2>Find the device you need.</h2><p>Search by asset name, asset tag, serial number, person or location.</p></div><div className="inventory-total"><strong>{assets.length}</strong><span>total assets</span></div></section>}

        {scannerOpen && <section className="scanner-panel">
          <div className="panel-title-row">
            <div><span className="eyebrow">CAMERA OCR · FIRST VERSION</span><h2>Scan a printed serial number</h2><p>Place the serial label in the camera view, capture it, then verify the text before confirming.</p></div>
            <button className="close-button" onClick={() => { setScannerOpen(false); setDetectedSerial(''); setScanMessage('') }} aria-label="Close scanner">×</button>
          </div>
          <div className="scanner-layout">
            <div className="camera-frame">
              <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
              {!cameraReady && !cameraError && <div className="camera-overlay">Starting camera…</div>}
              <div className="camera-guide" aria-hidden="true" />
            </div>
            <div className="scanner-controls">
              <p className="scanner-hint">Tip: fill the frame with the label, keep the camera steady and use bright, even lighting.</p>
              <button className="primary-button" onClick={captureAndReadSerial} disabled={!cameraReady || ocrBusy}>{ocrBusy ? 'Reading label…' : 'Capture and read text'}</button>
              <label className="serial-field">Detected serial number
                <input value={detectedSerial} onChange={(e) => setDetectedSerial(e.target.value.toUpperCase())} placeholder="Review or type serial number" autoCapitalize="characters" />
              </label>
              <button className="secondary-button" onClick={confirmSerialScan} disabled={!detectedSerial.trim()}>Confirm scan</button>
              {scanMessage && <p className="scan-message" role="status">{scanMessage}</p>}
              {cameraError && <p className="scan-error" role="alert">{cameraError}</p>}
              <p className="scanner-count">Confirmed this session: <strong>{scannedSerials.length}</strong></p>
              {scannedSerials.length > 0 && <div className="scanned-list">{scannedSerials.slice().reverse().map((serial) => <span key={serial}>{serial}</span>)}</div>}
            </div>
          </div>
          <p className="feature-note">Prototype only: confirmed scans currently live in this browser session. They are not yet saved as permanent audit records. Inventory matching works only when a record already contains a serialNumber or serial field.</p>
        </section>}

        {error && <div className="notice error-notice" role="alert"><strong>Something went wrong</strong><p>{error}</p><button className="secondary-button" onClick={loadAssets}>Retry</button></div>}
        {success && <div role="status" className="notice success-notice">✓ {success}</div>}

        {showForm && <section className="form-panel">
          <div className="panel-title-row"><div><span className="eyebrow">NEW RECORD</span><h2>Register an asset</h2><p>Enter the details you know. We can expand this form for audit and camera capture later.</p></div><button className="close-button" onClick={() => setShowForm(false)} aria-label="Close form">×</button></div>
          <form onSubmit={addAsset} className="asset-form">
            <label>Asset name<input required value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="e.g. Lenovo Chromebook" /></label>
            <label>Category<select value={newAsset.category} onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}><option>Chromebook</option><option>Laptop</option><option>Printer</option><option>Monitor</option><option>Networking</option><option>Robotics kit</option><option>Projector</option><option>Other</option></select></label>
            <label>Assigned to<input value={newAsset.assignedTo} onChange={(e) => setNewAsset({ ...newAsset, assignedTo: e.target.value })} placeholder="Person or department" /></label>
            <label>Location<input required value={newAsset.location} onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })} placeholder="e.g. High School IT room" /></label>
            <label>Status<select value={newAsset.status} onChange={(e) => setNewAsset({ ...newAsset, status: e.target.value })}><option>Available</option><option>Assigned</option><option>Maintenance</option><option>Retired</option></select></label>
            <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save asset'}</button></div>
          </form>
        </section>}

        {(activePage === 'inventory' || activePage === 'maintenance' || activePage === 'overview') && <section className="inventory-panel">
          <div className="inventory-header"><div><span className="eyebrow">{activePage === 'maintenance' ? 'REPAIR & FOLLOW-UP' : 'ASSET REGISTER'}</span><h2>{activePage === 'maintenance' ? 'Assets needing attention' : activePage === 'overview' ? 'Recently registered assets' : 'All registered assets'}</h2><p>{activePage === 'maintenance' ? 'Review equipment marked for maintenance.' : 'Your live inventory from the AssetFlow database.'}</p></div><button className="secondary-button" onClick={() => { setSearch(''); setFilter(activePage === 'maintenance' ? 'Maintenance' : 'All') }}>Reset filters</button></div>
          <div className="toolbar"><div className="search-wrap"><span>⌕</span><input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, tag, serial or location…" aria-label="Search assets" /></div><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status"><option>All</option><option>Assigned</option><option>Available</option><option>Maintenance</option><option>Retired</option></select></div>
          <div className="table-wrapper"><table><thead><tr><th>ASSET</th><th>ASSET TAG</th><th>LOCATION</th><th>ASSIGNED TO</th><th>STATUS</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan="5" className="empty-state">Loading assets from the database…</td></tr> : filteredAssets.map((asset) => <tr key={asset._id || asset.assetTag}><td><div className="asset-name"><span className="device-icon">▣</span><div><strong>{asset.name || 'Unnamed asset'}</strong><small>{asset.category || 'Uncategorised'}</small></div></div></td><td className="asset-id">{asset.assetTag || asset._id || '—'}</td><td>{asset.location || '—'}</td><td>{asset.assignedTo || 'Unassigned'}</td><td><span className={`status-badge ${(asset.status || 'available').toLowerCase()}`}>{asset.status || 'Unknown'}</span></td></tr>)}
              {!loading && filteredAssets.length === 0 && <tr><td colSpan="5" className="empty-state">{assets.length === 0 ? 'No assets have been registered yet.' : 'No matching assets. Try changing your search or filters.'}</td></tr>}
            </tbody></table></div>
          <footer className="table-footer"><span>Showing {loading ? '—' : filteredAssets.length} of {loading ? '—' : assets.length} assets</span><span className="database-status"><span className="connection-dot" /> Live database · MongoDB Atlas</span></footer>
        </section>}
        <footer className="page-footer">AssetFlow <span>•</span> IT Asset Management <span>•</span> Nova Pioneer Ruimsig</footer>
      </main>
    </div>
  )
}

function StatCard({ label, value, detail, icon, tone }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></article>
}
function QuickCard({ icon, title, description, action, onClick, tone }) {
  return <button className="quick-card" onClick={onClick}><span className={`quick-icon ${tone}`}>{icon}</span><strong>{title}</strong><p>{description}</p><span className="quick-action">{action} <b>→</b></span></button>
}
export default App
