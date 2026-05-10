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

  const handleLogin = (e) => {
    e.preventDefault();
    const creds = btoa(`${username}:${password}`);
    setAuthCredentials(creds);
    if (username === process.env.REACT_APP_ADMIN_USERNAME) {
      setUserRole('admin');
    } else {
      setUserRole('sales');
    }
    setIsAuthenticated(true);
    setLoginError('');
  };

  const shiftDateRange = (direction) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === 'today') {
      if (direction === -1) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setCustomDates({ start: yesterday.toISOString().split('T')[0], end: yesterday.toISOString().split('T')[0] });
        setDateRange('custom');
      }
    } else if (dateRange === 'yesterday') {
      if (direction === -1) {
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        setCustomDates({ start: twoDaysAgo.toISOString().split('T')[0], end: twoDaysAgo.toISOString().split('T')[0] });
        setDateRange('custom');
      } else {
        setDateRange('today');
      }
    } else if (dateRange === '7d') {
      const newEnd = new Date(today);
      newEnd.setDate(newEnd.getDate() + (direction * 7));
      const newStart = new Date(newEnd);
      newStart.setDate(newStart.getDate() - 7);
      setCustomDates({ start: newStart.toISOString().split('T')[0], end: newEnd.toISOString().split('T')[0] });
      setDateRange('custom');
    } else if (dateRange === '30d') {
      const newEnd = new Date(today);
      newEnd.setDate(newEnd.getDate() + (direction * 30));
      const newStart = new Date(newEnd);
      newStart.setDate(newStart.getDate() - 30);
      setCustomDates({ start: newStart.toISOString().split('T')[0], end: newEnd.toISOString().split('T')[0] });
      setDateRange('custom');
    } else if (dateRange === '90d') {
      const newEnd = new Date(today);
      newEnd.setDate(newEnd.getDate() + (direction * 90));
      const newStart = new Date(newEnd);
      newStart.setDate(newStart.getDate() - 90);
      setCustomDates({ start: newStart.toISOString().split('T')[0], end: newEnd.toISOString().split('T')[0] });
      setDateRange('custom');
    } else if (dateRange === 'custom') {
      const start = new Date(customDates.start);
      const end = new Date(customDates.end);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const newStart = new Date(start);
      newStart.setDate(newStart.getDate() + (direction * daysDiff));
      const newEnd = new Date(end);
      newEnd.setDate(newEnd.getDate() + (direction * daysDiff));
      setCustomDates({ start: newStart.toISOString().split('T')[0], end: newEnd.toISOString().split('T')[0] });
    }
  };

  const getDateRangeParams = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let startDate, endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    switch(dateRange) {
      case 'today':
        startDate = new Date(today);
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case '7d':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'alltime':
        return null;
      case 'custom':
        if (!customDates.start || !customDates.end) return null;
        startDate = new Date(customDates.start);
        endDate = new Date(customDates.end);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  const callAPI = async (tableName, method = 'GET', recordId = null, fields = null) => {
    let creds = authCredentials;
    if (!creds) {
      setIsAuthenticated(false);
      throw new Error('Authentication required');
    }

    let queryParams = '';
    if (method === 'GET') {
      queryParams = `?tableName=${encodeURIComponent(tableName)}`;
      const dates = getDateRangeParams();
      if (dates && tableName !== 'Google Cost Data') {
        queryParams += `&startDate=${dates.startDate}&endDate=${dates.endDate}`;
      }
    }

    const body = method === 'GET' ? null : JSON.stringify({ tableName, recordId, fields });

    const response = await fetch(`/api/airtable${queryParams}`, {
      method: method === 'GET' ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${creds}`
      },
      body
    });

    if (response.status === 401) {
      setAuthCredentials(null);
      setIsAuthenticated(false);
      throw new Error('Invalid credentials');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return await response.json();
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [costResp, mortgageResp, remortgageResp, deadMortgageResp, deadRemortgageResp] = await Promise.all([
        callAPI('Google Cost Data'),
        callAPI('BTL Mortgage Lead Data'),
        callAPI('BTL Remortgage Lead Data'),
        callAPI('Dead BTL Mortgage Leads'),
        callAPI('Dead BTL Remortgage Leads')
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
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && dateRange === 'custom' && customDates.start && customDates.end) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customDates, dateRange, isAuthenticated]);

  const handleLeadAction = async (leadId, leadType, field, currentValue) => {
    try {
      const tableName = leadType === 'Mortgage' ? 'BTL Mortgage Lead Data' : 'BTL Remortgage Lead Data';
      const newValue = !currentValue;
      await callAPI(tableName, 'PATCH', leadId, { [field]: newValue });

      setDisplayLeads(prev => prev.map(lead =>
        lead.id === leadId ? { ...lead, fields: { ...lead.fields, [field]: newValue } } : lead
      ));

      if (leadType === 'Mortgage') {
        setMortgageLeads(prev => prev.map(lead =>
          lead.id === leadId ? { ...lead, fields: { ...lead.fields, [field]: newValue } } : lead
        ));
      } else {
        setRemortgageLeads(prev => prev.map(lead =>
          lead.id === leadId ? { ...lead, fields: { ...lead.fields, [field]: newValue } } : lead
        ));
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Airtable percentage fields come back as decimals e.g. 0.25 = 25%
  // This normalises to a 0-100 scale regardless of how it's stored
  const normalisePercent = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const num = parseFloat(String(val).replace('%', ''));
    if (isNaN(num)) return 0;
    // If stored as decimal (e.g. 0.25), convert to percentage
    return num <= 1 ? num * 100 : num;
  };

  const calculateMetrics = () => {
    const totalCost = googleCostData.reduce((sum, r) => sum + (r.fields.Cost || 0), 0);
    const totalRawLeads = mortgageLeads.length + remortgageLeads.length + deadMortgageLeads.length + deadRemortgageLeads.length;
    const phoneVerifiedLeads = mortgageLeads.length + remortgageLeads.length;
    const allLeads = [...mortgageLeads, ...remortgageLeads];

    const mortgageAnswered = mortgageLeads.filter(l => l.fields['Phone Answered']).length;
    const mortgageBooked = mortgageLeads.filter(l => l.fields['Appointment Booked']).length;
    const mortgageDIP = mortgageLeads.filter(l => l.fields['DIP Agreed']).length;
    const mortgagePickupRate = mortgageLeads.length > 0 ? (mortgageAnswered / mortgageLeads.length) * 100 : 0;
    const mortgageBookingRate = mortgageAnswered > 0 ? (mortgageBooked / mortgageAnswered) * 100 : 0;
    const mortgageDIPRate = mortgageBooked > 0 ? (mortgageDIP / mortgageBooked) * 100 : 0;

    const remortgageAnswered = remortgageLeads.filter(l => l.fields['Phone Answered']).length;
    const remortgageBooked = remortgageLeads.filter(l => l.fields['Appointment Booked']).length;
    const remortgageDIP = remortgageLeads.filter(l => l.fields['DIP Agreed']).length;
    const remortgagePickupRate = remortgageLeads.length > 0 ? (remortgageAnswered / remortgageLeads.length) * 100 : 0;
    const remortgageBookingRate = remortgageAnswered > 0 ? (remortgageBooked / remortgageAnswered) * 100 : 0;
    const remortgageDIPRate = remortgageBooked > 0 ? (remortgageDIP / remortgageBooked) * 100 : 0;

    const answeredPhoneLeads = allLeads.filter(l => l.fields['Phone Answered']).length;
    const appointmentBookedLeads = allLeads.filter(l => l.fields['Appointment Booked']).length;
    const answeredMQLLeads = allLeads.filter(l => l.fields['Phone Answered'] && l.fields['Lead Rank']).length;
    const dipAgreedCount = allLeads.filter(l => l.fields['DIP Agreed']).length;
    const pickupRate = phoneVerifiedLeads > 0 ? (answeredPhoneLeads / phoneVerifiedLeads) * 100 : 0;
    const appointmentBookingRate = answeredPhoneLeads > 0 ? (appointmentBookedLeads / answeredPhoneLeads) * 100 : 0;
    const dipAgreedRate = appointmentBookedLeads > 0 ? (dipAgreedCount / appointmentBookedLeads) * 100 : 0;

    return {
      totalCost,
      costPerRawLead: totalRawLeads > 0 ? totalCost / totalRawLeads : 0,
      costPerPhoneVerified: phoneVerifiedLeads > 0 ? totalCost / phoneVerifiedLeads : 0,
      costPerAnswered: answeredPhoneLeads > 0 ? totalCost / answeredPhoneLeads : 0,
      costPerMQL: answeredMQLLeads > 0 ? totalCost / answeredMQLLeads : 0,
      totalRawLeads, phoneVerifiedLeads, answeredPhoneLeads, appointmentBookedLeads,
      pickupRate, appointmentBookingRate, dipAgreedRate,
      mortgagePickupRate, mortgageBookingRate, mortgageDIPRate,
      remortgagePickupRate, remortgageBookingRate, remortgageDIPRate,
    };
  };

  const getMortgageVsRemortgage = () => [
    { name: 'Mortgage', value: mortgageLeads.length },
    { name: 'Remortgage', value: remortgageLeads.length }
  ];

  const getDirectorOwner = () => {
    const yesCount = [...mortgageLeads, ...remortgageLeads].filter(l => l.fields['Director/Owner'] === 'Yes').length;
    const noCount = [...mortgageLeads, ...remortgageLeads].filter(l => l.fields['Director/Owner'] === 'No').length;
    return [{ name: 'Yes', value: yesCount }, { name: 'No', value: noCount }];
  };

  const getHasOtherProperties = () => {
    const hasBTL = [...mortgageLeads, ...remortgageLeads].filter(l => {
      const btlCount = l.fields['Current BTLs'];
      return btlCount && (btlCount === '1' || btlCount === '2' || btlCount === '3' || btlCount === '4' || btlCount === '5+' || parseInt(btlCount) > 0);
    }).length;
    const noBTL = [...mortgageLeads, ...remortgageLeads].filter(l => {
      const btlCount = l.fields['Current BTLs'];
      return !btlCount || btlCount === '0' || parseInt(btlCount) === 0;
    }).length;
    return [{ name: 'Yes', value: hasBTL }, { name: 'No', value: noBTL }];
  };

  const get25PercentDeposit = () => {
    const has25 = mortgageLeads.filter(l => normalisePercent(l.fields['Deposit %']) >= 25).length;
    const no25 = mortgageLeads.filter(l => normalisePercent(l.fields['Deposit %']) < 25).length;
    return [{ name: '25%+ Deposit', value: has25 }, { name: 'Under 25%', value: no25 }];
  };

  const getRemortgageLTV = () => {
    const within = remortgageLeads.filter(l => normalisePercent(l.fields['LTV']) <= 75).length;
    const above = remortgageLeads.filter(l => normalisePercent(l.fields['LTV']) > 75).length;
    return [{ name: '75% or Below', value: within }, { name: 'Above 75%', value: above }];
  };

  const getMortgagePropertyRanges = () => {
    const ranges = { '0-100k': 0, '100k-200k': 0, '200k-300k': 0, '300k-400k': 0, '400k-500k': 0, '500k+': 0 };
    mortgageLeads.forEach(lead => {
      const amount = parseFloat(lead.fields['Loan Amount']);
      if (!amount) return;
      if (amount < 100000) ranges['0-100k']++;
      else if (amount < 200000) ranges['100k-200k']++;
      else if (amount < 300000) ranges['200k-300k']++;
      else if (amount < 400000) ranges['300k-400k']++;
      else if (amount < 500000) ranges['400k-500k']++;
      else ranges['500k+']++;
    });
    return Object.keys(ranges).map(key => ({ range: key, count: ranges[key] }));
  };

  const getRemortgagePropertyRanges = () => {
    const ranges = { '0-100k': 0, '100k-200k': 0, '200k-300k': 0, '300k-400k': 0, '400k-500k': 0, '500k+': 0 };
    remortgageLeads.forEach(lead => {
      const amount = parseFloat(lead.fields['Property Value']);
      if (!amount) return;
      if (amount < 100000) ranges['0-100k']++;
      else if (amount < 200000) ranges['100k-200k']++;
      else if (amount < 300000) ranges['200k-300k']++;
      else if (amount < 400000) ranges['300k-400k']++;
      else if (amount < 500000) ranges['400k-500k']++;
      else ranges['500k+']++;
    });
    return Object.keys(ranges).map(key => ({ range: key, count: ranges[key] }));
  };

  const getMortgageStageData = () => {
    const stages = ['Looking for a Property', 'Found a Property', 'Made an offer', 'Paid a deposit'];
    return stages.map(stage => ({
      stage: stage.replace('Looking for a Property', 'Looking').replace('Found a Property', 'Found').replace('Made an offer', 'Offer').replace('Paid a deposit', 'Paid Deposit'),
      total: mortgageLeads.filter(l => l.fields.Stage === stage).length,
      answered: mortgageLeads.filter(l => l.fields.Stage === stage && l.fields['Phone Answered']).length
    }));
  };

  const getRemortgageStageData = () => {
    const stages = ['Rate Shopping', 'Within the next 6 months', 'Within the next 3 months', 'ASAP'];
    return stages.map(stage => ({
      stage: stage.replace('Within the next 3 months', '3 months').replace('Within the next 6 months', '6 months').replace('Rate Shopping', 'Rate Shop'),
      total: remortgageLeads.filter(l => l.fields.Stage === stage).length,
      answered: remortgageLeads.filter(l => l.fields.Stage === stage && l.fields['Phone Answered']).length
    }));
  };

  const getFilteredLeads = (leads) => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase().trim();

    let altQ = null;
    if (q.startsWith('0')) {
      altQ = '+44' + q.slice(1);
    } else if (q.startsWith('+44')) {
      altQ = '0' + q.slice(3);
    } else if (q.startsWith('44')) {
      altQ = '0' + q.slice(2);
    }

    return leads.filter(lead => {
      const firstName = (lead.fields.First_Name || '').toLowerCase();
      const lastName = (lead.fields.Last_Name || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`;
      const phone = (lead.fields.Phone || '').toLowerCase();
      return fullName.includes(q) || firstName.includes(q) || lastName.includes(q) ||
        phone.includes(q) || (altQ && phone.includes(altQ));
    });
  };

  const metrics = isAuthenticated ? calculateMetrics() : null;
  const pieColors = ['#FF3366', '#2BB4A0'];
  const binaryPieColors = ['#3c3c3c', '#ffffff'];
  const thresholdPieColors = ['#2BB4A0', '#FF3366'];
  const chartColors = { primary: '#FF3366', secondary: '#3c3c3c' };

  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const getGradientStyle = (baseColor, opacity) => ({
    backgroundColor: hexToRgba(baseColor, opacity),
    borderColor: baseColor
  });

  const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent === 0) return null;
    return (
      <text x={x} y={y} fill="#3c3c3c" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: '12px', fontWeight: '600' }}>
        {`${name}: ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const renderLeadActions = (lead) => (
    <td>
      <button
        disabled={lead.fields['Phone Answered']}
        onClick={() => handleLeadAction(lead.id, lead.type, 'Phone Answered', lead.fields['Phone Answered'])}
        className="action-btn"
      >
        {lead.fields['Phone Answered'] ? 'Answered ✓' : 'Answered Phone'}
      </button>
      <button
        onClick={() => handleLeadAction(lead.id, lead.type, 'Appointment Booked', lead.fields['Appointment Booked'])}
        className={`action-btn booked${lead.fields['Appointment Booked'] ? ' active' : ''}`}
      >
        {lead.fields['Appointment Booked'] ? 'Booked ✓' : 'Appointment Booked'}
      </button>
      <button
        onClick={() => handleLeadAction(lead.id, lead.type, 'DIP Agreed', lead.fields['DIP Agreed'])}
        className={`action-btn dip${lead.fields['DIP Agreed'] ? ' active' : ''}`}
      >
        {lead.fields['DIP Agreed'] ? 'Agreed ✓' : 'DIP Agreed'}
      </button>
    </td>
  );

  const renderSalesPerformance = () => (
    <>
      <h2>BTL Mortgage</h2>
      <div className="metrics-grid-3">
        <div className="metric-card" style={getGradientStyle('#FF3366', 0.9)}>
          <div className="metric-value">{metrics.mortgagePickupRate.toFixed(1)}%</div>
          <div className="metric-label">Pick Up Rate</div>
        </div>
        <div className="metric-card" style={getGradientStyle('#FF3366', 0.9)}>
          <div className="metric-value">{metrics.mortgageBookingRate.toFixed(1)}%</div>
          <div className="metric-label">Appointment Booking Rate</div>
        </div>
        <div className="metric-card" style={getGradientStyle('#FF3366', 0.9)}>
          <div className="metric-value">{metrics.mortgageDIPRate.toFixed(1)}%</div>
          <div className="metric-label">DIP Agreed Rate</div>
        </div>
      </div>

      <h2>BTL Remortgage</h2>
      <div className="metrics-grid-3">
        <div className="metric-card" style={getGradientStyle('#2BB4A0', 0.9)}>
          <div className="metric-value">{metrics.remortgagePickupRate.toFixed(1)}%</div>
          <div className="metric-label">Pick Up Rate</div>
        </div>
        <div className="metric-card" style={getGradientStyle('#2BB4A0', 0.9)}>
          <div className="metric-value">{metrics.remortgageBookingRate.toFixed(1)}%</div>
          <div className="metric-label">Appointment Booking Rate</div>
        </div>
        <div className="metric-card" style={getGradientStyle('#2BB4A0', 0.9)}>
          <div className="metric-value">{metrics.remortgageDIPRate.toFixed(1)}%</div>
          <div className="metric-label">DIP Agreed Rate</div>
        </div>
      </div>

      <h2>Overall</h2>
      <div className="metrics-grid-3">
        <div className="metric-card" style={{ backgroundColor: '#3c3c3c', borderColor: '#3c3c3c' }}>
          <div className="metric-value">{metrics.pickupRate.toFixed(1)}%</div>
          <div className="metric-label">Pick Up Rate</div>
        </div>
        <div className="metric-card" style={{ backgroundColor: '#3c3c3c', borderColor: '#3c3c3c' }}>
          <div className="metric-value">{metrics.appointmentBookingRate.toFixed(1)}%</div>
          <div className="metric-label">Appointment Booking Rate</div>
        </div>
        <div className="metric-card" style={{ backgroundColor: '#3c3c3c', borderColor: '#3c3c3c' }}>
          <div className="metric-value">{metrics.dipAgreedRate.toFixed(1)}%</div>
          <div className="metric-label">DIP Agreed Rate</div>
        </div>
      </div>
    </>
  );

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <img src="/lendscope-logo.png" alt="LendScope Logo" className="login-logo" />
          <h1 className="login-title">Marketing Dashboard</h1>
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input type="text" id="username" name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="login-button">Login</button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h3>Error Loading Data</h3>
        <p>{error}</p>
        <button onClick={fetchData}>Retry</button>
      </div>
    );
  }

  const datePickerModal = showDatePicker && (
    <div className="date-picker-modal">
      <div className="date-picker-content">
        <h3>Select Date Range</h3>
        <label>Start Date: <input type="date" value={customDates.start} onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))} /></label>
        <label>End Date: <input type="date" value={customDates.end} onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))} /></label>
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
        <select value={dateRange} onChange={(e) => {
          if (e.target.value === 'custom') { setShowDatePicker(true); } else { setDateRange(e.target.value); }
        }}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="alltime">All Time</option>
          <option value="custom">Custom Range</option>
        </select>
      ) : (
        <div className="custom-date-display">
          {customDates.start} to {customDates.end}
          <button onClick={() => setShowDatePicker(true)}>Edit</button>
        </div>
      )}
      <button onClick={() => shiftDateRange(1)} className="arrow-btn" disabled={dateRange === 'alltime' || dateRange === 'today'}>→</button>
      <button onClick={fetchData} className="refresh-btn">Refresh</button>
    </div>
  );

  // Sales Dashboard
  if (userRole === 'sales') {
    const filteredLeads = getFilteredLeads(displayLeads);
    return (
      <div className="dashboard">
        <div className="header">
          <img src="/lendscope-logo.png" alt="LendScope Logo" className="logo-image" />
          {headerControls}
        </div>
        {datePickerModal}

        {renderSalesPerformance()}

        <div className="leads-table-card">
          <div className="leads-table-header">
            <h3>Leads for Selected Period ({filteredLeads.length}{searchQuery ? ` of ${displayLeads.length}` : ''})</h3>
            <input
              type="text"
              className="leads-search"
              placeholder="Search by name or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Type</th>
                <th>Phone</th>
                <th>Lead Rank</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px'}}>
                  {searchQuery ? 'No leads match your search' : 'No leads for this period'}
                </td></tr>
              ) : (
                filteredLeads.map(lead => (
                  <tr key={lead.id}>
                    <td>{lead.fields.First_Name && lead.fields.Last_Name ? `${lead.fields.First_Name} ${lead.fields.Last_Name}`.trim() : lead.fields.First_Name || lead.fields.Last_Name || 'No name'}</td>
                    <td>{lead.fields.Date ? new Date(lead.fields.Date).toLocaleDateString('en-GB') : 'N/A'}</td>
                    <td><span className={`badge ${lead.type.toLowerCase()}`}>{lead.type}</span></td>
                    <td>{lead.fields.Phone || 'N/A'}</td>
                    <td>{lead.fields['Lead Rank'] || 'N/A'}</td>
                    {renderLeadActions(lead)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  const filteredAdminLeads = getFilteredLeads(displayLeads);
  return (
    <div className="dashboard">
      <div className="header">
        <img src="/lendscope-logo.png" alt="LendScope Logo" className="logo-image" />
        {headerControls}
      </div>
      {datePickerModal}

      <h2>Lead Cost Analysis</h2>
      <div className="metrics-grid">
        <div className="metric-card" style={{ backgroundColor: '#3c3c3c', borderColor: '#3c3c3c' }}>
          <div className="metric-value">£{metrics.costPerRawLead.toFixed(2)}</div>
          <div className="metric-label">Cost Per Raw Lead</div>
        </div>
        <div className="metric-card" style={{ backgroundColor: '#3c3c3c', borderColor: '#3c3c3c' }}>
          <div className="metric-value">£{metrics.costPerPhoneVerified.toFixed(2)}</div>
          <div className="metric-label">Cost Per Lead (Phone Verified)</div>
        </div>
        <div className="metric-card" style={{ backgroundColor: '#3c3c3c', borderColor: '#3c3c3c' }}>
          <div className="metric-value">£{metrics.costPerAnswered.toFixed(2)}</div>
          <div className="metric-label">Cost Per Lead (Answered Phone)</div>
        </div>
        <div className="metric-card" style={{ backgroundColor: '#3c3c3c', borderColor: '#3c3c3c' }}>
          <div className="metric-value">£{metrics.costPerMQL.toFixed(2)}</div>
          <div className="metric-label">Cost Per Lead (Answered + MQL)</div>
        </div>
      </div>

      {renderSalesPerformance()}

      <h2>Lead Breakdown</h2>
      <div className="charts-grid-3">
        <div className="chart-card">
          <h3>Mortgage vs Remortgage</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={getMortgageVsRemortgage()} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={{ stroke: '#3c3c3c', strokeWidth: 1 }}>
                {getMortgageVsRemortgage().map((entry, index) => (<Cell key={`cell-${index}`} fill={pieColors[index]} />))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Director/Owner</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={getDirectorOwner()} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={{ stroke: '#3c3c3c', strokeWidth: 1 }}>
                {getDirectorOwner().map((entry, index) => (<Cell key={`cell-${index}`} fill={binaryPieColors[index]} stroke="#ddd" strokeWidth={index === 1 ? 1 : 0} />))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Has Other Properties</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={getHasOtherProperties()} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={{ stroke: '#3c3c3c', strokeWidth: 1 }}>
                {getHasOtherProperties().map((entry, index) => (<Cell key={`cell-${index}`} fill={binaryPieColors[index]} stroke="#ddd" strokeWidth={index === 1 ? 1 : 0} />))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Deposit Status (Mortgage)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={get25PercentDeposit()} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={{ stroke: '#3c3c3c', strokeWidth: 1 }}>
                {get25PercentDeposit().map((entry, index) => (<Cell key={`cell-${index}`} fill={thresholdPieColors[index]} />))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>LTV Status (Remortgage)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={getRemortgageLTV()} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={{ stroke: '#3c3c3c', strokeWidth: 1 }}>
                {getRemortgageLTV().map((entry, index) => (<Cell key={`cell-${index}`} fill={thresholdPieColors[index]} />))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Mortgage Stages</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={getMortgageStageData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill={chartColors.primary} name="Total" />
              <Bar dataKey="answered" fill={chartColors.secondary} name="Answered" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Remortgage Stages</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={getRemortgageStageData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill={chartColors.primary} name="Total" />
              <Bar dataKey="answered" fill={chartColors.secondary} name="Answered" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Mortgage Property Value</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={getMortgagePropertyRanges()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={chartColors.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Remortgage Property Value</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={getRemortgagePropertyRanges()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={'#2BB4A0'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="leads-table-card">
        <div className="leads-table-header">
          <h3>All Leads for Selected Period ({filteredAdminLeads.length}{searchQuery ? ` of ${displayLeads.length}` : ''})</h3>
          <input
            type="text"
            className="leads-search"
            placeholder="Search by name or phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Date</th>
              <th>Type</th>
              <th>Phone</th>
              <th>Stage</th>
              <th>Lead Rank</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAdminLeads.length === 0 ? (
              <tr><td colSpan="7" style={{textAlign: 'center', padding: '40px'}}>
                {searchQuery ? 'No leads match your search' : 'No leads for this period'}
              </td></tr>
            ) : (
              filteredAdminLeads.map(lead => (
                <tr key={lead.id}>
                  <td>{lead.fields.First_Name && lead.fields.Last_Name ? `${lead.fields.First_Name} ${lead.fields.Last_Name}`.trim() : lead.fields.First_Name || lead.fields.Last_Name || 'No name'}</td>
                  <td>{lead.fields.Date ? new Date(lead.fields.Date).toLocaleDateString('en-GB') : 'N/A'}</td>
                  <td><span className={`badge ${lead.type.toLowerCase()}`}>{lead.type}</span></td>
                  <td>{lead.fields.Phone || 'N/A'}</td>
                  <td>{lead.fields.Stage || 'N/A'}</td>
                  <td>{lead.fields['Lead Rank'] || 'N/A'}</td>
                  {renderLeadActions(lead)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default App;
