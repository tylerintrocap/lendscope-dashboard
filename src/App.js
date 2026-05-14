import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import './App.css';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleCostData, setGoogleCostData] = useState([]);
  const [mortgageLeads, setMortgageLeads] = useState([]);
  const [remortgageLeads, setRemortgageLeads] = useState([]);
  const [deadMortgageLeads, setDeadMortgageLeads] = useState([]);
  const [deadRemortgageLeads, setDeadRemortgageLeads] = useState([]);
  const [displayLeads, setDisplayLeads] = useState([]);
  const [dateRange, setDateRange] = useState('30d');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [authCredentials, setAuthCredentials] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chartDataSource, setChartDataSource] = useState('form');
  const [leadsFilter, setLeadsFilter] = useState('active'); // 'all' or 'active'

  const handleLogin = (e) => {
    e.preventDefault();
    const creds = btoa(`${username}:${password}`);
    setAuthCredentials(creds);
    setUserRole(username === process.env.REACT_APP_ADMIN_USERNAME ? 'admin' : 'sales');
    setIsAuthenticated(true);
    setLoginError('');
  };

  const getUKDateString = (date) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const d = {};
    parts.forEach(p => { d[p.type] = p.value; });
    return `${d.year}-${d.month}-${d.day}`;
  };

  const getUKToday = () => getUKDateString(new Date());
  const getUKYesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return getUKDateString(d); };

  const shiftDateRange = (direction) => {
    if (dateRange === 'today') {
      if (direction === -1) { const y = getUKYesterday(); setCustomDates({ start: y, end: y }); setDateRange('custom'); }
    } else if (dateRange === 'yesterday') {
      if (direction === -1) { const d = new Date(); d.setDate(d.getDate() - 2); const s = getUKDateString(d); setCustomDates({ start: s, end: s }); setDateRange('custom'); }
      else setDateRange('today');
    } else if (dateRange === '7d') {
      const end = new Date(); end.setDate(end.getDate() + direction * 7); const start = new Date(end); start.setDate(start.getDate() - 7);
      setCustomDates({ start: getUKDateString(start), end: getUKDateString(end) }); setDateRange('custom');
    } else if (dateRange === '30d') {
      const end = new Date(); end.setDate(end.getDate() + direction * 30); const start = new Date(end); start.setDate(start.getDate() - 30);
      setCustomDates({ start: getUKDateString(start), end: getUKDateString(end) }); setDateRange('custom');
    } else if (dateRange === '90d') {
      const end = new Date(); end.setDate(end.getDate() + direction * 90); const start = new Date(end); start.setDate(start.getDate() - 90);
      setCustomDates({ start: getUKDateString(start), end: getUKDateString(end) }); setDateRange('custom');
    } else if (dateRange === 'custom') {
      const start = new Date(customDates.start); const end = new Date(customDates.end);
      const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      start.setDate(start.getDate() + direction * diff); end.setDate(end.getDate() + direction * diff);
      setCustomDates({ start: getUKDateString(start), end: getUKDateString(end) });
    }
  };

  const getDateRangeParams = () => {
    const t = getUKToday(); const y = getUKYesterday();
    switch(dateRange) {
      case 'today': return { startDate: t, endDate: t };
      case 'yesterday': return { startDate: y, endDate: y };
      case '7d': { const d = new Date(); d.setDate(d.getDate() - 7); return { startDate: getUKDateString(d), endDate: t }; }
      case '30d': { const d = new Date(); d.setDate(d.getDate() - 30); return { startDate: getUKDateString(d), endDate: t }; }
      case '90d': { const d = new Date(); d.setDate(d.getDate() - 90); return { startDate: getUKDateString(d), endDate: t }; }
      case 'alltime': return null;
      case 'custom': if (!customDates.start || !customDates.end) return null; return { startDate: customDates.start, endDate: customDates.end };
      default: { const d = new Date(); d.setDate(d.getDate() - 30); return { startDate: getUKDateString(d), endDate: t }; }
    }
  };

  const callAPI = async (tableName, method = 'GET', recordId = null, fields = null) => {
    if (!authCredentials) { setIsAuthenticated(false); throw new Error('Authentication required'); }
    let queryParams = '';
    if (method === 'GET') {
      queryParams = `?tableName=${encodeURIComponent(tableName)}`;
      const dates = getDateRangeParams();
      if (dates && tableName !== 'Google Cost Data') queryParams += `&startDate=${dates.startDate}&endDate=${dates.endDate}`;
    }
    const response = await fetch(`/api/airtable${queryParams}`, {
      method: method === 'GET' ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${authCredentials}` },
      body: method === 'GET' ? null : JSON.stringify({ tableName, recordId, fields })
    });
    if (response.status === 401) { setAuthCredentials(null); setIsAuthenticated(false); throw new Error('Invalid credentials'); }
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'API request failed'); }
    return await response.json();
  };

  const fetchData = async () => {
    try {
      setLoading(true); setError(null);
      const [costResp, mortgageResp, remortgageResp, deadMortgageResp, deadRemortgageResp] = await Promise.all([
        callAPI('Google Cost Data'), callAPI('BTL Mortgage Lead Data'), callAPI('BTL Remortgage Lead Data'),
        callAPI('Dead BTL Mortgage Leads'), callAPI('Dead BTL Remortgage Leads')
      ]);
      setGoogleCostData(costResp.records || []);
      setMortgageLeads(mortgageResp.records || []);
      setRemortgageLeads(remortgageResp.records || []);
      setDeadMortgageLeads(deadMortgageResp.records || []);
      setDeadRemortgageLeads(deadRemortgageResp.records || []);
      const allLeads = [
        ...(mortgageResp.records || []).map(l => ({ ...l, type: 'Mortgage' })),
        ...(remortgageResp.records || []).map(l => ({ ...l, type: 'Remortgage' }))
      ].sort((a, b) => new Date(b.fields.Date) - new Date(a.fields.Date));
      setDisplayLeads(allLeads);
      setLoading(false);
    } catch (err) { setError(err.message); setLoading(false); }
  };

  useEffect(() => { if (isAuthenticated) fetchData(); }, [dateRange, isAuthenticated]); // eslint-disable-line
  useEffect(() => { if (isAuthenticated && dateRange === 'custom' && customDates.start && customDates.end) fetchData(); }, [customDates, dateRange, isAuthenticated]); // eslint-disable-line

  const handleLeadAction = async (leadId, leadType, field, currentValue) => {
    try {
      const tableName = leadType === 'Mortgage' ? 'BTL Mortgage Lead Data' : 'BTL Remortgage Lead Data';
      const newValue = !currentValue;
      await callAPI(tableName, 'PATCH', leadId, { [field]: newValue });
      const update = prev => prev.map(l => l.id === leadId ? { ...l, fields: { ...l.fields, [field]: newValue } } : l);
      setDisplayLeads(update);
      if (leadType === 'Mortgage') setMortgageLeads(update); else setRemortgageLeads(update);
    } catch (err) { alert(`Error: ${err.message}`); }
  };

  const handleDropdownChange = async (leadId, leadType, field, value) => {
    try {
      const tableName = leadType === 'Mortgage' ? 'BTL Mortgage Lead Data' : 'BTL Remortgage Lead Data';
      await callAPI(tableName, 'PATCH', leadId, { [field]: value });
      const update = prev => prev.map(l => l.id === leadId ? { ...l, fields: { ...l.fields, [field]: value } } : l);
      setDisplayLeads(update);
      if (leadType === 'Mortgage') setMortgageLeads(update); else setRemortgageLeads(update);
    } catch (err) { alert(`Error: ${err.message}`); }
  };

  const normalisePercent = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const num = parseFloat(String(val).replace('%', ''));
    if (isNaN(num)) return 0;
    return num <= 1 ? num * 100 : num;
  };

  const isReadyForActions = (lead) => {
    const stage = lead.fields['Stage (Sales)'];
    const director = lead.fields['Director (Sales)'];
    const btls = lead.fields['Current BTLs (Sales)'];
    return !!(stage && director && btls !== undefined && btls !== null && btls !== '');
  };

  const getMortgageStageOptions = () => ['Looking for a Property', 'Found a Property', 'Made an offer', 'Paid a deposit'];
  const getRemortgageStageOptions = () => ['ASAP', 'Within next 3 months', 'Within next 6 months', 'Rate Shopping'];

  const calculateMetrics = () => {
    const totalCost = googleCostData.reduce((sum, r) => sum + (r.fields.Cost || 0), 0);
    const totalRawLeads = mortgageLeads.length + remortgageLeads.length + deadMortgageLeads.length + deadRemortgageLeads.length;
    const phoneVerifiedLeads = mortgageLeads.length + remortgageLeads.length;
    const allLeads = [...mortgageLeads, ...remortgageLeads];

    const mAns = mortgageLeads.filter(l => l.fields['Phone Answered']).length;
    const mBook = mortgageLeads.filter(l => l.fields['Appointment Booked']).length;
    const mDIP = mortgageLeads.filter(l => l.fields['DIP Agreed']).length;
    const rAns = remortgageLeads.filter(l => l.fields['Phone Answered']).length;
    const rBook = remortgageLeads.filter(l => l.fields['Appointment Booked']).length;
    const rDIP = remortgageLeads.filter(l => l.fields['DIP Agreed']).length;
    const answered = allLeads.filter(l => l.fields['Phone Answered']).length;
    const booked = allLeads.filter(l => l.fields['Appointment Booked']).length;
    const mql = allLeads.filter(l => l.fields['Phone Answered'] && l.fields['Lead Rank']).length;
    const dip = allLeads.filter(l => l.fields['DIP Agreed']).length;

    return {
      totalCost,
      costPerRawLead: totalRawLeads > 0 ? totalCost / totalRawLeads : 0,
      costPerPhoneVerified: phoneVerifiedLeads > 0 ? totalCost / phoneVerifiedLeads : 0,
      costPerAnswered: answered > 0 ? totalCost / answered : 0,
      costPerMQL: mql > 0 ? totalCost / mql : 0,
      pickupRate: phoneVerifiedLeads > 0 ? (answered / phoneVerifiedLeads) * 100 : 0,
      appointmentBookingRate: answered > 0 ? (booked / answered) * 100 : 0,
      dipAgreedRate: booked > 0 ? (dip / booked) * 100 : 0,
      mortgagePickupRate: mortgageLeads.length > 0 ? (mAns / mortgageLeads.length) * 100 : 0,
      mortgageBookingRate: mAns > 0 ? (mBook / mAns) * 100 : 0,
      mortgageDIPRate: mBook > 0 ? (mDIP / mBook) * 100 : 0,
      remortgagePickupRate: remortgageLeads.length > 0 ? (rAns / remortgageLeads.length) * 100 : 0,
      remortgageBookingRate: rAns > 0 ? (rBook / rAns) * 100 : 0,
      remortgageDIPRate: rBook > 0 ? (rDIP / rBook) * 100 : 0,
    };
  };

  const getMortgageVsRemortgage = () => [{ name: 'Mortgage', value: mortgageLeads.length }, { name: 'Remortgage', value: remortgageLeads.length }];
  const getDirectorOwner = () => {
    const all = [...mortgageLeads, ...remortgageLeads];
    return [{ name: 'Yes', value: all.filter(l => l.fields['Director/Owner'] === 'Yes').length }, { name: 'No', value: all.filter(l => l.fields['Director/Owner'] === 'No').length }];
  };
  const getHasOtherProperties = () => {
    const all = [...mortgageLeads, ...remortgageLeads];
    const yes = all.filter(l => { const b = l.fields['Current BTLs']; return b && (b === '1' || b === '2' || b === '3' || b === '4' || b === '5+' || parseInt(b) > 0); }).length;
    const no = all.filter(l => { const b = l.fields['Current BTLs']; return !b || b === '0' || parseInt(b) === 0; }).length;
    return [{ name: 'Yes', value: yes }, { name: 'No', value: no }];
  };
  const getMortgageStageData = () => ['Looking for a Property', 'Found a Property', 'Made an offer', 'Paid a deposit'].map(stage => ({
    stage: stage.replace('Looking for a Property', 'Looking').replace('Found a Property', 'Found').replace('Made an offer', 'Offer').replace('Paid a deposit', 'Paid Deposit'),
    total: mortgageLeads.filter(l => l.fields.Stage === stage).length,
    answered: mortgageLeads.filter(l => l.fields.Stage === stage && l.fields['Phone Answered']).length
  }));
  const getRemortgageStageData = () => {
    const match = (s, vs) => vs.some(v => (s || '').trim() === v.trim());
    return [
      { variants: ['Rate Shopping', 'Rate shopping'], label: 'Rate Shop' },
      { variants: ['Within next 6 months', 'Within the next 6 months'], label: '6 months' },
      { variants: ['Within next 3 months', 'Within the next 3 months'], label: '3 months' },
      { variants: ['ASAP', 'asap'], label: 'ASAP' },
    ].map(({ variants, label }) => ({
      stage: label,
      total: remortgageLeads.filter(l => match(l.fields.Stage, variants)).length,
      answered: remortgageLeads.filter(l => match(l.fields.Stage, variants) && l.fields['Phone Answered']).length
    }));
  };
  const getDirectorOwnerSales = () => {
    const all = [...mortgageLeads, ...remortgageLeads];
    return [{ name: 'Yes', value: all.filter(l => l.fields['Director (Sales)'] === 'Yes').length }, { name: 'No', value: all.filter(l => l.fields['Director (Sales)'] === 'No').length }];
  };
  const getHasOtherPropertiesSales = () => {
    const all = [...mortgageLeads, ...remortgageLeads];
    const yes = all.filter(l => { const b = l.fields['Current BTLs (Sales)']; return b && (b === '1' || b === '2' || b === '3' || b === '4' || b === '5+' || parseInt(b) > 0); }).length;
    const no = all.filter(l => { const b = l.fields['Current BTLs (Sales)']; return !b || b === '0' || parseInt(b) === 0; }).length;
    return [{ name: 'Yes', value: yes }, { name: 'No', value: no }];
  };
  const getMortgageStageDataSales = () => ['Looking for a Property', 'Found a Property', 'Made an offer', 'Paid a deposit'].map(stage => ({
    stage: stage.replace('Looking for a Property', 'Looking').replace('Found a Property', 'Found').replace('Made an offer', 'Offer').replace('Paid a deposit', 'Paid Deposit'),
    total: mortgageLeads.filter(l => l.fields['Stage (Sales)'] === stage).length,
    answered: mortgageLeads.filter(l => l.fields['Stage (Sales)'] === stage && l.fields['Phone Answered']).length
  }));
  const getRemortgageStageDataSales = () => [
    { variants: ['Rate Shopping'], label: 'Rate Shop' },
    { variants: ['Within next 6 months'], label: '6 months' },
    { variants: ['Within next 3 months'], label: '3 months' },
    { variants: ['ASAP'], label: 'ASAP' },
  ].map(({ variants, label }) => ({
    stage: label,
    total: remortgageLeads.filter(l => variants.includes(l.fields['Stage (Sales)'])).length,
    answered: remortgageLeads.filter(l => variants.includes(l.fields['Stage (Sales)']) && l.fields['Phone Answered']).length
  }));
  const get25PercentDeposit = () => [
    { name: '25%+ Deposit', value: mortgageLeads.filter(l => normalisePercent(l.fields['Deposit %']) >= 25).length },
    { name: 'Under 25%', value: mortgageLeads.filter(l => normalisePercent(l.fields['Deposit %']) < 25).length }
  ];
  const getRemortgageLTV = () => [
    { name: '75% or Below', value: remortgageLeads.filter(l => normalisePercent(l.fields['LTV']) <= 75).length },
    { name: 'Above 75%', value: remortgageLeads.filter(l => normalisePercent(l.fields['LTV']) > 75).length }
  ];
  const getMortgagePropertyRanges = () => {
    const ranges = { '0-100k': 0, '100k-200k': 0, '200k-300k': 0, '300k-400k': 0, '400k-500k': 0, '500k+': 0 };
    mortgageLeads.forEach(l => { const a = parseFloat(l.fields['Loan Amount']); if (!a) return; if (a < 100000) ranges['0-100k']++; else if (a < 200000) ranges['100k-200k']++; else if (a < 300000) ranges['200k-300k']++; else if (a < 400000) ranges['300k-400k']++; else if (a < 500000) ranges['400k-500k']++; else ranges['500k+']++; });
    return Object.keys(ranges).map(k => ({ range: k, count: ranges[k] }));
  };
  const getRemortgagePropertyRanges = () => {
    const ranges = { '0-100k': 0, '100k-200k': 0, '200k-300k': 0, '300k-400k': 0, '400k-500k': 0, '500k+': 0 };
    remortgageLeads.forEach(l => { const a = parseFloat(l.fields['Property Value']); if (!a) return; if (a < 100000) ranges['0-100k']++; else if (a < 200000) ranges['100k-200k']++; else if (a < 300000) ranges['200k-300k']++; else if (a < 400000) ranges['300k-400k']++; else if (a < 500000) ranges['400k-500k']++; else ranges['500k+']++; });
    return Object.keys(ranges).map(k => ({ range: k, count: ranges[k] }));
  };

  const getFilteredLeads = (leads) => {
    let filtered = leads;

    // Apply active/all filter
    if (leadsFilter === 'active') {
      filtered = filtered.filter(l => !l.fields['Dead']);
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      let altQ = null;
      if (q.startsWith('0')) altQ = '+44' + q.slice(1);
      else if (q.startsWith('+44')) altQ = '0' + q.slice(3);
      else if (q.startsWith('44')) altQ = '0' + q.slice(2);
      filtered = filtered.filter(l => {
        const fn = (l.fields.First_Name || '').toLowerCase();
        const ln = (l.fields.Last_Name || '').toLowerCase();
        const ph = (l.fields.Phone || '').toLowerCase();
        return `${fn} ${ln}`.includes(q) || fn.includes(q) || ln.includes(q) || ph.includes(q) || (altQ && ph.includes(altQ));
      });
    }

    return filtered;
  };

  const metrics = isAuthenticated ? calculateMetrics() : null;
  const pieColors = ['#FF3366', '#2BB4A0'];
  const binaryPieColors = ['#3c3c3c', '#ffffff'];
  const thresholdPieColors = ['#2BB4A0', '#FF3366'];
  const chartColors = { primary: '#FF3366', secondary: '#3c3c3c' };
  const remortgageChartColors = { primary: '#2BB4A0', secondary: '#3c3c3c' };

  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };
  const getGradientStyle = (color, opacity) => ({ backgroundColor: hexToRgba(color, opacity), borderColor: color });

  const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent === 0) return null;
    return <text x={x} y={y} fill="#3c3c3c" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: '12px', fontWeight: '600' }}>{`${name}: ${(percent * 100).toFixed(0)}%`}</text>;
  };

  const renderLeadRow = (lead) => {
    const ready = isReadyForActions(lead);
    const isDead = !!lead.fields['Dead'];
    const stageOptions = lead.type === 'Mortgage' ? getMortgageStageOptions() : getRemortgageStageOptions();
    const currentStage = lead.fields['Stage (Sales)'] || '';
    const currentDirector = lead.fields['Director (Sales)'] || '';
    const currentBTLs = lead.fields['Current BTLs (Sales)'] !== undefined && lead.fields['Current BTLs (Sales)'] !== null ? String(lead.fields['Current BTLs (Sales)']) : '';

    return (
      <tr key={lead.id} style={{ opacity: isDead ? 0.45 : 1, background: isDead ? '#fff5f5' : 'transparent' }}>
        <td>{lead.fields.First_Name && lead.fields.Last_Name ? `${lead.fields.First_Name} ${lead.fields.Last_Name}`.trim() : lead.fields.First_Name || lead.fields.Last_Name || 'No name'}</td>
        <td>{lead.fields.Date ? new Date(lead.fields.Date).toLocaleDateString('en-GB') : 'N/A'}</td>
        <td><span className={`badge ${lead.type.toLowerCase()}`}>{lead.type}</span></td>
        <td>{lead.fields.Phone || 'N/A'}</td>
        <td>
          <select className="lead-dropdown" value={currentStage} onChange={(e) => handleDropdownChange(lead.id, lead.type, 'Stage (Sales)', e.target.value)} disabled={isDead}>
            <option value="">Stage...</option>
            {stageOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td>
          <select className="lead-dropdown" value={currentDirector} onChange={(e) => handleDropdownChange(lead.id, lead.type, 'Director (Sales)', e.target.value)} disabled={isDead}>
            <option value="">Director?</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </td>
        <td>
          <select className="lead-dropdown" value={currentBTLs} onChange={(e) => handleDropdownChange(lead.id, lead.type, 'Current BTLs (Sales)', e.target.value)} disabled={isDead}>
            <option value="">BTLs...</option>
            {['0','1','2','3','4','5+'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </td>
        <td>
          {!isDead && !ready && (
            <span style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>Fill Stage, Director & BTLs first</span>
          )}
          {!isDead && ready && (
            <>
              <button disabled={lead.fields['Phone Answered']} onClick={() => handleLeadAction(lead.id, lead.type, 'Phone Answered', lead.fields['Phone Answered'])} className="action-btn">
                {lead.fields['Phone Answered'] ? 'Answered ✓' : 'Answered Phone'}
              </button>
              <button onClick={() => handleLeadAction(lead.id, lead.type, 'Appointment Booked', lead.fields['Appointment Booked'])} className={`action-btn booked${lead.fields['Appointment Booked'] ? ' active' : ''}`}>
                {lead.fields['Appointment Booked'] ? 'Booked ✓' : 'Appointment Booked'}
              </button>
              <button onClick={() => handleLeadAction(lead.id, lead.type, 'DIP Agreed', lead.fields['DIP Agreed'])} className={`action-btn dip${lead.fields['DIP Agreed'] ? ' active' : ''}`}>
                {lead.fields['DIP Agreed'] ? 'Agreed ✓' : 'DIP Agreed'}
              </button>
            </>
          )}
          {/* Dead button — always visible */}
          <button
            onClick={() => handleLeadAction(lead.id, lead.type, 'Dead', lead.fields['Dead'])}
            className={`action-btn dead-btn${isDead ? ' dead-active' : ''}`}
            title={isDead ? 'Mark as Active' : 'Mark as Dead'}
          >
            {isDead ? '↩ Revive' : '✕ Dead'}
          </button>
        </td>
      </tr>
    );
  };

  const renderSalesPerformance = () => (
    <>
      <h2>Sales Performance</h2>
      <div className="sales-performance-grid">
        <div className="sales-perf-block" style={{ borderTop: '4px solid #FF3366' }}>
          <div className="sales-perf-title" style={{ color: '#FF3366' }}>BTL Mortgage</div>
          <div className="metrics-grid-3">
            <div className="metric-card" style={getGradientStyle('#FF3366', 0.9)}><div className="metric-value">{metrics.mortgagePickupRate.toFixed(1)}%</div><div className="metric-label">Pick Up Rate</div></div>
            <div className="metric-card" style={getGradientStyle('#FF3366', 0.9)}><div className="metric-value">{metrics.mortgageBookingRate.toFixed(1)}%</div><div className="metric-label">Appt. Booking</div></div>
            <div className="metric-card" style={getGradientStyle('#FF3366', 0.9)}><div className="metric-value">{metrics.mortgageDIPRate.toFixed(1)}%</div><div className="metric-label">DIP Agreed</div></div>
          </div>
        </div>
        <div className="sales-perf-block" style={{ borderTop: '4px solid #2BB4A0' }}>
          <div className="sales-perf-title" style={{ color: '#2BB4A0' }}>BTL Remortgage</div>
          <div className="metrics-grid-3">
            <div className="metric-card" style={getGradientStyle('#2BB4A0', 0.9)}><div className="metric-value">{metrics.remortgagePickupRate.toFixed(1)}%</div><div className="metric-label">Pick Up Rate</div></div>
            <div className="metric-card" style={getGradientStyle('#2BB4A0', 0.9)}><div className="metric-value">{metrics.remortgageBookingRate.toFixed(1)}%</div><div className="metric-label">Appt. Booking</div></div>
            <div className="metric-card" style={getGradientStyle('#2BB4A0', 0.9)}><div className="metric-value">{metrics.remortgageDIPRate.toFixed(1)}%</div><div className="metric-label">DIP Agreed</div></div>
          </div>
        </div>
        <div className="sales-perf-block" style={{ borderTop: '4px solid #3c3c3c' }}>
          <div className="sales-perf-title" style={{ color: '#3c3c3c' }}>Overall</div>
          <div className="metrics-grid-3">
            <div className="metric-card" style={{ backgroundColor: '#3c3c3c', borderColor: '#3c3c3c' }}><div className="metric-value">{metrics.pickupRate.toFixed(1)}%</div><div className="metric-label">Pick Up Rate</div></div>
            <div className="metric-card" style={{ backgroundColor: '#3c3c3c', borderColor: '#3c3c3c' }}><div className="metric-value">{metrics.appointmentBookingRate.toFixed(1)}%</div><div className="metric-label">Appt. Booking</div></div>
            <div className="metric-card" style={{ backgroundColor: '#3c3c3c', borderColor: '#3c3c3c' }}><div className="metric-value">{metrics.dipAgreedRate.toFixed(1)}%</div><div className="metric-label">DIP Agreed</div></div>
          </div>
        </div>
      </div>
    </>
  );

  const renderCharts = () => {
    const directorData = chartDataSource === 'form' ? getDirectorOwner() : getDirectorOwnerSales();
    const btlData = chartDataSource === 'form' ? getHasOtherProperties() : getHasOtherPropertiesSales();
    const mortgageStageData = chartDataSource === 'form' ? getMortgageStageData() : getMortgageStageDataSales();
    const remortgageStageData = chartDataSource === 'form' ? getRemortgageStageData() : getRemortgageStageDataSales();

    return (
      <>
        <div className="chart-toggle-header">
          <h2>Lead Breakdown</h2>
          <div className="chart-toggle">
            <button className={`toggle-btn${chartDataSource === 'form' ? ' active' : ''}`} onClick={() => setChartDataSource('form')}>Form Data</button>
            <button className={`toggle-btn${chartDataSource === 'sales' ? ' active' : ''}`} onClick={() => setChartDataSource('sales')}>Sales Data</button>
          </div>
        </div>
        <div className="charts-grid-3">
          <div className="chart-card"><h3>Mortgage vs Remortgage</h3>
            <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={getMortgageVsRemortgage()} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={{ stroke: '#3c3c3c', strokeWidth: 1 }}>{getMortgageVsRemortgage().map((e, i) => <Cell key={i} fill={pieColors[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          </div>
          <div className="chart-card"><h3>Director/Owner{chartDataSource === 'sales' ? ' (Sales)' : ''}</h3>
            <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={directorData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={{ stroke: '#3c3c3c', strokeWidth: 1 }}>{directorData.map((e, i) => <Cell key={i} fill={binaryPieColors[i]} stroke="#ddd" strokeWidth={i === 1 ? 1 : 0} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          </div>
          <div className="chart-card"><h3>Has Other Properties{chartDataSource === 'sales' ? ' (Sales)' : ''}</h3>
            <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={btlData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={{ stroke: '#3c3c3c', strokeWidth: 1 }}>{btlData.map((e, i) => <Cell key={i} fill={binaryPieColors[i]} stroke="#ddd" strokeWidth={i === 1 ? 1 : 0} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          </div>
        </div>
        <div className="charts-grid">
          <div className="chart-card"><h3>Deposit Status (Mortgage)</h3>
            <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={get25PercentDeposit()} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={{ stroke: '#3c3c3c', strokeWidth: 1 }}>{get25PercentDeposit().map((e, i) => <Cell key={i} fill={thresholdPieColors[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          </div>
          <div className="chart-card"><h3>LTV Status (Remortgage)</h3>
            <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={getRemortgageLTV()} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={{ stroke: '#3c3c3c', strokeWidth: 1 }}>{getRemortgageLTV().map((e, i) => <Cell key={i} fill={thresholdPieColors[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          </div>
        </div>
        <div className="charts-grid">
          <div className="chart-card"><h3>Mortgage Stages{chartDataSource === 'sales' ? ' (Sales)' : ''}</h3>
            <ResponsiveContainer width="100%" height={250}><BarChart data={mortgageStageData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="stage" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="total" fill={chartColors.primary} name="Total" /><Bar dataKey="answered" fill={chartColors.secondary} name="Answered" /></BarChart></ResponsiveContainer>
          </div>
          <div className="chart-card"><h3>Remortgage Stages{chartDataSource === 'sales' ? ' (Sales)' : ''}</h3>
            <ResponsiveContainer width="100%" height={250}><BarChart data={remortgageStageData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="stage" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="total" fill={remortgageChartColors.primary} name="Total" /><Bar dataKey="answered" fill={remortgageChartColors.secondary} name="Answered" /></BarChart></ResponsiveContainer>
          </div>
        </div>
        <div className="charts-grid">
          <div className="chart-card"><h3>Mortgage Property Value</h3>
            <ResponsiveContainer width="100%" height={250}><BarChart data={getMortgagePropertyRanges()}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="range" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill={chartColors.primary} /></BarChart></ResponsiveContainer>
          </div>
          <div className="chart-card"><h3>Remortgage Property Value</h3>
            <ResponsiveContainer width="100%" height={250}><BarChart data={getRemortgagePropertyRanges()}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="range" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#2BB4A0" /></BarChart></ResponsiveContainer>
          </div>
        </div>
      </>
    );
  };

  const renderLeadsTable = (leads, title) => {
    const filtered = getFilteredLeads(leads);
    const totalActive = leads.filter(l => !l.fields['Dead']).length;
    const totalAll = leads.length;

    return (
      <div className="leads-table-card">
        <div className="leads-table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <h3>{title} ({filtered.length}{searchQuery ? ` of ${leadsFilter === 'active' ? totalActive : totalAll}` : leadsFilter === 'active' ? ` of ${totalActive} active` : ` of ${totalAll}`})</h3>
            <div className="chart-toggle">
              <button className={`toggle-btn${leadsFilter === 'active' ? ' active' : ''}`} onClick={() => setLeadsFilter('active')}>Active</button>
              <button className={`toggle-btn${leadsFilter === 'all' ? ' active' : ''}`} onClick={() => setLeadsFilter('all')}>All</button>
            </div>
          </div>
          <input type="text" className="leads-search" placeholder="Search by name or phone number..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <table>
          <thead>
            <tr><th>Name</th><th>Date</th><th>Type</th><th>Phone</th><th>Stage</th><th>Director?</th><th>BTLs</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan="8" style={{textAlign:'center',padding:'40px'}}>{searchQuery ? 'No leads match your search' : leadsFilter === 'active' ? 'No active leads for this period' : 'No leads for this period'}</td></tr>
              : filtered.map(l => renderLeadRow(l))
            }
          </tbody>
        </table>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <img src="/lendscope-logo.png" alt="LendScope Logo" className="login-logo" />
          <h1 className="login-title">Marketing Dashboard</h1>
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group"><label htmlFor="username">Username</label><input type="text" id="username" name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
            <div className="form-group"><label htmlFor="password">Password</label><input type="password" id="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="login-button">Login</button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading dashboard...</p></div>;
  if (error) return <div className="error-screen"><h3>Error Loading Data</h3><p>{error}</p><button onClick={fetchData}>Retry</button></div>;

  const datePickerModal = showDatePicker && (
    <div className="date-picker-modal">
      <div className="date-picker-content">
        <h3>Select Date Range</h3>
        <label>Start Date: <input type="date" value={customDates.start} onChange={(e) => setCustomDates(p => ({ ...p, start: e.target.value }))} /></label>
        <label>End Date: <input type="date" value={customDates.end} onChange={(e) => setCustomDates(p => ({ ...p, end: e.target.value }))} /></label>
        <div className="modal-buttons">
          <button onClick={() => { setShowDatePicker(false); setDateRange('30d'); }}>Cancel</button>
          <button onClick={() => { setDateRange('custom'); setShowDatePicker(false); }}>Apply</button>
        </div>
      </div>
    </div>
  );

  const headerControls = (
    <div className="header-controls">
      <button onClick={() => shiftDateRange(-1)} className="arrow-btn" disabled={dateRange === 'alltime'}>←</button>
      {dateRange !== 'custom' ? (
        <select value={dateRange} onChange={(e) => { if (e.target.value === 'custom') setShowDatePicker(true); else setDateRange(e.target.value); }}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="alltime">All Time</option>
          <option value="custom">Custom Range</option>
        </select>
      ) : (
        <div className="custom-date-display">{customDates.start} to {customDates.end}<button onClick={() => setShowDatePicker(true)}>Edit</button></div>
      )}
      <button onClick={() => shiftDateRange(1)} className="arrow-btn" disabled={dateRange === 'alltime' || dateRange === 'today'}>→</button>
      <button onClick={fetchData} className="refresh-btn">Refresh</button>
    </div>
  );

  if (userRole === 'sales') {
    return (
      <div className="dashboard">
        <div className="header"><img src="/lendscope-logo.png" alt="LendScope Logo" className="logo-image" />{headerControls}</div>
        {datePickerModal}
        {renderSalesPerformance()}
        {renderLeadsTable(displayLeads, 'Leads for Selected Period')}
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="header"><img src="/lendscope-logo.png" alt="LendScope Logo" className="logo-image" />{headerControls}</div>
      {datePickerModal}

      <h2>Lead Cost Analysis</h2>
      <div className="metrics-grid">
        {[
          { val: metrics.costPerRawLead, label: 'Cost Per Raw Lead' },
          { val: metrics.costPerPhoneVerified, label: 'Cost Per Lead (Phone Verified)' },
          { val: metrics.costPerAnswered, label: 'Cost Per Lead (Answered Phone)' },
          { val: metrics.costPerMQL, label: 'Cost Per Lead (Answered + MQL)' },
        ].map((m, i) => (
          <div key={i} className="metric-card" style={{ backgroundColor: '#3c3c3c', borderColor: '#3c3c3c' }}>
            <div className="metric-value">£{m.val.toFixed(2)}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      {renderSalesPerformance()}
      {renderCharts()}
      {renderLeadsTable(displayLeads, 'All Leads for Selected Period')}
    </div>
  );
};

export default App;
