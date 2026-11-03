import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { API_BASE_URL } from './config';

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Mini Map Component for Payment/Boarding Request Card
function MiniLocationMap({ lat, lng, locationName }) {
  if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) return null;
  const position = [Number(lat), Number(lng)];

  return (
    <div className="w-full h-36 rounded-xl overflow-hidden border border-slate-200 shadow-2xs relative z-0 my-2">
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        zoomControl={false}
        dragging={false}
        doubleClickZoom={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={position}>
          {locationName && <Popup>{locationName}</Popup>}
        </Marker>
      </MapContainer>
      <div className="absolute bottom-1 right-1 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] text-slate-600 font-bold border border-slate-200 z-[400] shadow-2xs pointer-events-none">
        {locationName || '탑승 위치'}
      </div>
    </div>
  );
}

export default function MessagePanel({ currentUser, selectedAcademyId, socket, isClosing }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchRoomQuery, setSearchRoomQuery] = useState('');

  // New Chat Modal State
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [categoryUsers, setCategoryUsers] = useState({ drivers: [], teachers: [], parents: [], admins: [] });
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [customGroupName, setCustomGroupName] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Participant list popover state
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  // Payment / Boarding Request Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoadingPaymentContext, setIsLoadingPaymentContext] = useState(false);
  const [paymentContext, setPaymentContext] = useState({ vehicles: [], students: [], pickupPoints: [] });
  const [paymentForm, setPaymentForm] = useState({
    studentSelectMode: 'DROPDOWN',
    selectedStudentId: '',
    customStudentName: '',
    selectedVehicleId: '',
    locationSelectMode: 'PICKUP_POINT',
    selectedPickupPointId: '',
    boardingLocation: '',
    address: '',
    latitude: null,
    longitude: null,
    requestDate: new Date().toISOString().split('T')[0],
    note: '이 학생이 탑승을 하고 싶어 하는데 기존에 있던 곳에서 탑승하게 할까요',
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isDeciding, setIsDeciding] = useState(null);

  const messagesEndRef = useRef(null);
  const activeRoomRef = useRef(null);
  activeRoomRef.current = activeRoom;

  // Resolve user info from props or localStorage
  const myUser = currentUser || (() => {
    try {
      return JSON.parse(localStorage.getItem('takeme_user') || '{}');
    } catch (_) {
      return {};
    }
  })();

  const isParent = myUser.role === 'PARENT';
  const targetAcademyId = selectedAcademyId || myUser.academyId;

  // Initial Load: Fetch rooms
  useEffect(() => {
    fetchRooms();
  }, [myUser.email]);

  // Socket.IO event listeners
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (newMsg) => {
      if (!newMsg) return;
      const currentActive = activeRoomRef.current;
      const msgRoomId = newMsg.room?.id || newMsg.roomId;

      if (currentActive && Number(currentActive.id) === Number(msgRoomId)) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) {
            // Update existing message if payload status changed
            return prev.map((m) => (m.id === newMsg.id ? newMsg : m));
          }
          return [...prev, newMsg];
        });
        scrollToBottom();
      }

      // Update room list latest message
      setRooms((prevRooms) => {
        return prevRooms.map((r) => {
          if (Number(r.id) === Number(msgRoomId)) {
            return {
              ...r,
              latestMessage: newMsg,
              updatedAt: new Date().toISOString(),
              unreadCount: (currentActive && Number(currentActive.id) === Number(msgRoomId)) ? 0 : (r.unreadCount || 0) + 1,
            };
          }
          return r;
        }).sort((a, b) => {
          if (a.type === 'PAYMENT_SYSTEM') return -1;
          if (b.type === 'PAYMENT_SYSTEM') return 1;
          const tA = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : new Date(a.updatedAt || a.createdAt).getTime();
          const tB = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : new Date(b.updatedAt || b.createdAt).getTime();
          return tB - tA;
        });
      });
    };

    const handleRoomUpdated = () => {
      fetchRooms();
    };

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('roomUpdated', handleRoomUpdated);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('roomUpdated', handleRoomUpdated);
    };
  }, [socket]);

  // Join/Leave room socket channels when active room changes
  useEffect(() => {
    if (!activeRoom) return;

    if (socket) {
      socket.emit('joinChatRoom', { roomId: activeRoom.id });
    }

    fetchMessages(activeRoom.id);

    return () => {
      if (socket && activeRoom) {
        socket.emit('leaveChatRoom', { roomId: activeRoom.id });
      }
    };
  }, [activeRoom?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('takeme_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchRooms = async () => {
    if (!myUser?.email) return;
    try {
      const res = await fetch(`${API_BASE_URL}/chat/rooms?email=${encodeURIComponent(myUser.email)}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
        if (activeRoomRef.current) {
          const updated = data.find((r) => r.id === activeRoomRef.current.id);
          if (updated) setActiveRoom(updated);
        } else if (data.length > 0) {
          // Default to first room (which is PAYMENT_SYSTEM if present)
          setActiveRoom(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load chat rooms', e);
    }
  };

  const fetchMessages = async (roomId) => {
    try {
      const q = new URLSearchParams({ roomId: String(roomId) });
      if (myUser?.id) q.append('userId', String(myUser.id));
      const res = await fetch(`${API_BASE_URL}/chat/messages?${q.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        setRooms((prev) =>
          prev.map((r) => (Number(r.id) === Number(roomId) ? { ...r, unreadCount: 0 } : r))
        );
        scrollToBottom();
      }
    } catch (e) {
      console.error('Failed to load messages', e);
    }
  };

  const fetchCategoryUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const q = new URLSearchParams();
      if (targetAcademyId) q.append('academyId', String(targetAcademyId));
      if (myUser?.email) q.append('email', myUser.email);
      const res = await fetch(`${API_BASE_URL}/chat/users?${q.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setCategoryUsers({
          drivers: data.drivers || [],
          teachers: data.teachers || [],
          parents: data.parents || [],
          admins: data.admins || [],
        });
      }
    } catch (e) {
      console.error('Failed to load users for chat', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleOpenNewChatModal = () => {
    setSelectedUserIds([]);
    setSearchUserQuery('');
    setCustomGroupName('');
    setIsNewChatModalOpen(true);
    fetchCategoryUsers();
  };

  const handleToggleSelectUser = (id) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((uid) => uid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleStartChat = async () => {
    if (selectedUserIds.length === 0) {
      return alert('대화할 상대를 최소 1명 이상 선택해주세요.');
    }

    setIsCreatingRoom(true);
    try {
      const isGroup = selectedUserIds.length > 1;
      const res = await fetch(`${API_BASE_URL}/chat/rooms`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userIds: selectedUserIds,
          name: isGroup && customGroupName.trim() ? customGroupName.trim() : undefined,
          type: isGroup ? 'GROUP' : 'DIRECT',
          creatorEmail: myUser.email,
        }),
      });

      if (res.ok) {
        const createdRoom = await res.json();
        setIsNewChatModalOpen(false);
        setSelectedUserIds([]);
        setCustomGroupName('');
        await fetchRooms();
        setActiveRoom(createdRoom);
      } else {
        alert('채팅방 생성에 실패했습니다.');
      }
    } catch (e) {
      alert('오류가 발생했습니다.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || !activeRoom) return;

    setInputText('');
    setIsSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          roomId: activeRoom.id,
          text,
          senderEmail: myUser.email,
        }),
      });

      if (res.ok) {
        const savedMsg = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === savedMsg.id)) return prev;
          return [...prev, savedMsg];
        });
        scrollToBottom();
      } else {
        alert('메시지 전송에 실패했습니다.');
      }
    } catch (e) {
      alert('메시지 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ============================================================
  // 결제 및 탑승 신청 관련 핸들러
  // ============================================================

  const handleOpenPaymentModal = async () => {
    if (isParent) {
      return alert('학부모 계정은 결제 신청 기능을 이용할 수 없습니다.');
    }

    setIsPaymentModalOpen(true);
    setIsLoadingPaymentContext(true);

    try {
      const q = new URLSearchParams();
      if (targetAcademyId) q.append('academyId', String(targetAcademyId));
      if (myUser?.email) q.append('email', myUser.email);
      const res = await fetch(`${API_BASE_URL}/chat/payment-context?${q.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const ctx = await res.json();
        setPaymentContext(ctx);

        // Preselect first vehicle and pickup point if available
        const firstVehicle = ctx.vehicles?.[0];
        const firstPickup = ctx.pickupPoints?.[0];

        setPaymentForm((prev) => ({
          ...prev,
          selectedVehicleId: firstVehicle ? String(firstVehicle.id) : '',
          selectedPickupPointId: firstPickup ? String(firstPickup.id) : '',
          boardingLocation: firstPickup ? firstPickup.name : '',
          latitude: firstPickup ? firstPickup.latitude : null,
          longitude: firstPickup ? firstPickup.longitude : null,
          requestDate: new Date().toISOString().split('T')[0],
          note: '이 학생이 탑승을 하고 싶어 하는데 기존에 있던 곳에서 탑승하게 할까요',
        }));
      }
    } catch (e) {
      console.error('Failed to load payment context', e);
    } finally {
      setIsLoadingPaymentContext(false);
    }
  };

  const handleStudentSelect = (stId) => {
    if (stId === 'NEW') {
      setPaymentForm((prev) => ({
        ...prev,
        studentSelectMode: 'CUSTOM',
        selectedStudentId: '',
        customStudentName: '',
      }));
      return;
    }

    const st = paymentContext.students?.find((s) => String(s.id) === String(stId));
    if (!st) return;

    setPaymentForm((prev) => ({
      ...prev,
      studentSelectMode: 'DROPDOWN',
      selectedStudentId: String(st.id),
      customStudentName: st.name,
      selectedVehicleId: st.assignedBusId ? String(st.assignedBusId) : prev.selectedVehicleId,
      boardingLocation: st.boardingLocation || prev.boardingLocation,
      address: st.address || prev.address,
      latitude: st.lat || prev.latitude,
      longitude: st.lng || prev.longitude,
    }));
  };

  const handlePickupPointSelect = (pId) => {
    const pt = paymentContext.pickupPoints?.find((p) => String(p.id) === String(pId));
    if (!pt) return;

    setPaymentForm((prev) => ({
      ...prev,
      selectedPickupPointId: String(pt.id),
      boardingLocation: pt.name,
      latitude: pt.latitude,
      longitude: pt.longitude,
    }));
  };

  const handleSubmitPaymentRequest = async (e) => {
    e?.preventDefault();

    const studentName =
      paymentForm.studentSelectMode === 'CUSTOM'
        ? paymentForm.customStudentName.trim()
        : paymentContext.students?.find((s) => String(s.id) === String(paymentForm.selectedStudentId))?.name ||
          paymentForm.customStudentName.trim();

    if (!studentName) {
      return alert('원생(학생) 이름을 선택하거나 입력해주세요.');
    }

    if (!paymentForm.selectedVehicleId) {
      return alert('담당 차량(호차)을 선택해주세요.');
    }

    const boardingLocation = paymentForm.boardingLocation.trim();
    if (!boardingLocation) {
      return alert('탑승 희망 위치를 선택하거나 입력해주세요.');
    }

    setIsSubmittingPayment(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat/payment-request`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          studentId: paymentForm.selectedStudentId ? Number(paymentForm.selectedStudentId) : undefined,
          studentName,
          vehicleId: Number(paymentForm.selectedVehicleId),
          boardingLocation,
          address: paymentForm.address.trim() || boardingLocation,
          latitude: paymentForm.latitude || undefined,
          longitude: paymentForm.longitude || undefined,
          requestDate: paymentForm.requestDate,
          note: paymentForm.note.trim() || '이 학생이 탑승을 하고 싶어 하는데 기존에 있던 곳에서 탑승하게 할까요',
          requesterEmail: myUser.email,
        }),
      });

      if (res.ok) {
        const createdMsg = await res.json();
        setIsPaymentModalOpen(false);
        // If current active room is payment system room, append message
        if (activeRoom && activeRoom.type === 'PAYMENT_SYSTEM') {
          setMessages((prev) => {
            if (prev.some((m) => m.id === createdMsg.id)) return prev;
            return [...prev, createdMsg];
          });
          scrollToBottom();
        }
        await fetchRooms();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || '결제 신청서 발송에 실패했습니다.');
      }
    } catch (e) {
      alert('결제 신청 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleDecidePaymentRequest = async (messageId, decision) => {
    if (isDeciding) return;
    if (isParent) {
      return alert('학부모 계정은 승인 또는 거절 권한이 없습니다.');
    }

    const actionText = decision === 'APPROVED' ? '결제 및 탑승을 수락' : '결제 신청을 거절';
    if (!window.confirm(`${actionText}하시겠습니까?`)) {
      return;
    }

    setIsDeciding(messageId);

    try {
      const res = await fetch(`${API_BASE_URL}/chat/payment-request/${messageId}/decision`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          decision,
          decidedByEmail: myUser.email,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedMsg = data.message;
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMsg || { ...m, payload: { ...m.payload, status: decision } } : m))
        );
        fetchRooms();
        // Dispatch event for Dashboard to update map/stops if mounted
        window.dispatchEvent(new Event('takeme_route_updated'));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || '처리에 실패했습니다.');
      }
    } catch (e) {
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setIsDeciding(null);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'DRIVER':
        return <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">기사</span>;
      case 'TEACHER':
      case 'HOMEROOM_TEACHER':
      case 'SHUTTLE_TEACHER':
        return <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded">교사</span>;
      case 'PARENT':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">학부모</span>;
      case 'ACADEMY_ADMIN':
        return <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded">원장</span>;
      case 'SUPER_ADMIN':
        return <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded">통합관리</span>;
      default:
        return null;
    }
  };

  const getRoomTitle = (room) => {
    if (!room) return '';
    if (room.type === 'PAYMENT_SYSTEM' || room.name === '결제 시스템 방') {
      return '결제 시스템 방';
    }
    if (room.name && room.name !== '1:1 대화' && !room.name.includes('(')) {
      return room.name;
    }

    const members = (room.members || []).map((m) => m.user).filter(Boolean);
    const otherMembers = members.filter((u) => u.email !== myUser.email);

    if (otherMembers.length === 0) {
      return room.name || '나와의 대화';
    }

    if (otherMembers.length === 1) {
      const other = otherMembers[0];
      return `${other.name || '상대방'}`;
    }

    const names = otherMembers.slice(0, 3).map((u) => u.name || '사용자').join(', ');
    return `${names}${otherMembers.length > 3 ? ' 외' : ''} (${members.length}명)`;
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    hours = hours % 12 || 12;
    return `${ampm} ${hours}:${minutes}`;
  };

  const formatRoomListTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? '오후' : '오전';
      hours = hours % 12 || 12;
      return `${ampm} ${hours}:${minutes}`;
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return '어제';
    }

    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const filteredRooms = rooms.filter((r) => {
    const title = getRoomTitle(r).toLowerCase();
    const lastText = (r.latestMessage?.text || '').toLowerCase();
    const q = searchRoomQuery.toLowerCase();
    return title.includes(q) || lastText.includes(q);
  });

  // Filter users inside New Chat modal
  const filterUserList = (list) => {
    if (!searchUserQuery.trim()) return list;
    const q = searchUserQuery.toLowerCase().trim();
    return list.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const sub = (u.subText || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || sub.includes(q) || email.includes(q);
    });
  };

  const filteredDrivers = filterUserList(categoryUsers.drivers);
  const filteredTeachers = filterUserList(categoryUsers.teachers);
  const filteredParents = filterUserList(categoryUsers.parents);
  const filteredAdmins = filterUserList(categoryUsers.admins);

  // Group messages by date for date pill separators
  const messagesWithDates = messages.map((m, idx) => {
    const prev = messages[idx - 1];
    const prevDate = prev ? new Date(prev.createdAt).toDateString() : null;
    const currDate = new Date(m.createdAt).toDateString();
    const isNewDate = prevDate !== currDate;
    return {
      ...m,
      isNewDate,
      fullDateStr: new Date(m.createdAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }),
    };
  });

  const isCurrentRoomPaymentSystem = activeRoom?.type === 'PAYMENT_SYSTEM' || activeRoom?.name === '결제 시스템 방';

  return (
    <div
      className={`absolute inset-0 z-[2000] flex bg-slate-100 h-full overflow-hidden transition-all duration-300 ${
        isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
      }`}
    >
      {/* ============================================================ */}
      {/* LEFT COLUMN: 채팅방 목록 (Kakao Style Room List) */}
      {/* ============================================================ */}
      <div className="w-96 h-full border-r border-slate-200 flex flex-col bg-white overflow-hidden flex-shrink-0 shadow-sm">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800 tracking-tight leading-none">메세지함</h2>
              <span className="text-[11px] text-slate-400 font-medium">실시간 원내 메신저</span>
            </div>
          </div>

          {/* 메세지 보내기 (새 대화) 버튼 */}
          <button
            onClick={handleOpenNewChatModal}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-sm transition-all"
            title="새로운 상대 또는 그룹에게 메세지 보내기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>메세지 보내기</span>
          </button>
        </div>

        {/* Room Search Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="채팅방 또는 참여자 검색..."
              value={searchRoomQuery}
              onChange={(e) => setSearchRoomQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Chat Rooms Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredRooms.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600">진행 중인 채팅방이 없습니다.</p>
              <p className="text-[11px] text-slate-400 mt-1">상단의 [+ 메세지 보내기]를 눌러 대화를 시작하세요.</p>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isSelected = activeRoom && activeRoom.id === room.id;
              const isPaymentSystem = room.type === 'PAYMENT_SYSTEM' || room.name === '결제 시스템 방';
              const title = getRoomTitle(room);
              const isGroup = (room.members || []).length > 2 || room.type === 'GROUP';
              const lastText = isPaymentSystem
                ? room.latestMessage?.text || '신규 원생 탑승 및 결제 승인 요청 전용 채널입니다.'
                : room.latestMessage?.text || '대화를 시작해보세요.';
              const lastTime = formatRoomListTime(room.latestMessage?.createdAt || room.updatedAt || room.createdAt);

              // Find other member for role badge in 1:1
              const otherUser = (room.members || [])
                .map((m) => m.user)
                .find((u) => u && u.email !== myUser.email);

              return (
                <div
                  key={room.id}
                  onClick={() => setActiveRoom(room)}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Room Avatar */}
                  <div className="relative">
                    {isPaymentSystem ? (
                      <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                    ) : isGroup ? (
                      <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0">
                        그룹
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shadow-2xs flex-shrink-0">
                        {otherUser?.name?.[0] || title[0] || '대'}
                      </div>
                    )}
                  </div>

                  {/* Room Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {title}
                        </span>
                        {isPaymentSystem && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.2 rounded-md">
                            결제/승인
                          </span>
                        )}
                        {!isPaymentSystem && !isGroup && otherUser && getRoleBadge(otherUser.role)}
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{lastTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 truncate leading-snug">
                        {lastText}
                      </p>
                      {room.unreadCount > 0 && (
                        <span className="ml-1.5 flex-shrink-0 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full leading-tight">
                          {room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT COLUMN: 카톡 스타일 채팅 대화창 */}
      {/* ============================================================ */}
      <div className="flex-1 h-full flex flex-col bg-white overflow-hidden relative">
        {activeRoom ? (
          <>
            {/* Chat Room Header */}
            <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shadow-xs z-10 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-800 truncate">
                      {getRoomTitle(activeRoom)}
                    </h3>
                    {isCurrentRoomPaymentSystem ? (
                      <span className="text-[11px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                        신규 탑승 및 결제 승인 전용
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-bold">
                        {(activeRoom.members || []).length}명 참여중
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {isCurrentRoomPaymentSystem
                      ? '신규 학생 탑승 요청 및 담당 차량 지도교사 수락/거절 시스템 채널입니다.'
                      : (activeRoom.members || [])
                          .map((m) => m.user)
                          .filter(Boolean)
                          .map((u) => `${u.name || u.email}`)
                          .join(', ')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* 결제 신청 버튼 (학부모는 이용 불가) */}
                {isCurrentRoomPaymentSystem && !isParent && (
                  <button
                    type="button"
                    onClick={handleOpenPaymentModal}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                    title="신규 원생 결제 및 탑승 신청서 작성"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>결제 신청</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowParticipantsModal(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>참여자</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchMessages(activeRoom.id)}
                  className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50 transition-colors"
                  title="새로고침"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Kakao-style Messages Viewport */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-100">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <div className="p-3 bg-white/70 backdrop-blur-xs rounded-full shadow-xs mb-2">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold bg-white/80 px-3 py-1 rounded-full text-slate-600 shadow-xs">
                    {isCurrentRoomPaymentSystem
                      ? '결제 및 탑승 승인 내역이 여기에 표시됩니다. 상단 [결제 신청] 버튼으로 신청서를 작성하세요.'
                      : '새로운 대화가 시작되었습니다. 첫 메시지를 남겨보세요.'}
                  </p>
                </div>
              ) : (
                messagesWithDates.map((msg) => {
                  const isMine = msg.sender?.email === myUser.email || msg.sender?.id === myUser.id;
                  const senderName = msg.sender?.name || msg.sender?.email || '알 수 없음';
                  const senderRole = msg.sender?.role;
                  const isPaymentRequest = msg.type === 'PAYMENT_REQUEST' || Boolean(msg.payload);
                  const payload = msg.payload || {};

                  return (
                    <React.Fragment key={msg.id}>
                      {/* Date Separator Pill */}
                      {msg.isNewDate && (
                        <div className="flex justify-center my-3">
                          <span className="bg-black/15 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-2xs backdrop-blur-xs">
                            {msg.fullDateStr}
                          </span>
                        </div>
                      )}

                      {/* PAYMENT REQUEST CARD */}
                      {isPaymentRequest ? (
                        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} my-2 animate-fade-in`}>
                          {/* Sender Info Header */}
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            <span className="text-xs font-bold text-slate-800">{senderName}</span>
                            {senderRole && getRoleBadge(senderRole)}
                            <span className="text-[10px] text-slate-600 ml-1">
                              {formatMessageTime(msg.createdAt)}
                            </span>
                          </div>

                          {/* Card Body */}
                          <div className="bg-white border-2 border-indigo-200 rounded-2xl shadow-md overflow-hidden max-w-md w-full">
                            {/* Card Top Title Banner */}
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3.5 border-b border-indigo-100 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                  </svg>
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-indigo-950">신규 탑승 및 결제 승인 요청</h4>
                                  <span className="text-[10px] text-indigo-600 font-medium">담당 차량 지도교사 수락/거절</span>
                                </div>
                              </div>

                              {/* Status Badge */}
                              {payload.status === 'APPROVED' ? (
                                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  ✓ 결제 수락 완료
                                </span>
                              ) : payload.status === 'REJECTED' ? (
                                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                                  ✕ 결제 거절됨
                                </span>
                              ) : (
                                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                  승인 대기중
                                </span>
                              )}
                            </div>

                            {/* Card Content */}
                            <div className="p-4 space-y-3">
                              {/* 1. 메세지 */}
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                                <div className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  <span>신청 내용</span>
                                </div>
                                <p className="text-xs font-bold text-slate-800 leading-relaxed">
                                  "{payload.note || '이 학생이 탑승을 하고 싶어 하는데 기존에 있던 곳에서 탑승하게 할까요'}"
                                </p>
                              </div>

                              {/* Student & Bus Details */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                  <span className="text-[10px] font-bold text-slate-400 block">탑승 학생</span>
                                  <span className="font-extrabold text-slate-800 text-sm">{payload.studentName}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                                  <span className="text-[10px] font-bold text-blue-500 block">희망 차량</span>
                                  <span className="font-extrabold text-blue-900 text-sm">{payload.busNumber}</span>
                                  <span className="text-[10px] text-blue-600 block truncate">
                                    교사: {payload.teacherName}
                                  </span>
                                </div>
                              </div>

                              {/* 2. 날짜 */}
                              <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-slate-400 font-bold">탑승 희망 일자:</span>
                                <span className="font-extrabold text-slate-900">{payload.requestDate}</span>
                              </div>

                              {/* Location text */}
                              <div className="flex items-start gap-2 text-xs text-slate-700 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <div>
                                  <span className="text-slate-400 font-bold mr-1">탑승 위치:</span>
                                  <span className="font-extrabold text-slate-900">{payload.boardingLocation}</span>
                                  {payload.address && payload.address !== payload.boardingLocation && (
                                    <span className="text-[11px] text-slate-500 block mt-0.5">{payload.address}</span>
                                  )}
                                </div>
                              </div>

                              {/* 3. 지도 */}
                              <MiniLocationMap
                                lat={payload.latitude}
                                lng={payload.longitude}
                                locationName={payload.boardingLocation}
                              />

                              {/* 4. 결제 거절 / 수락 버튼 */}
                              {payload.status === 'APPROVED' ? (
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <div>
                                    <span>수락 완료: 해당 구역 및 노선에 자동 배정되었습니다.</span>
                                    {payload.decidedBy && (
                                      <span className="block text-[10px] text-emerald-600 font-normal">
                                        승인자: {payload.decidedBy} ({payload.decidedAt ? formatMessageTime(payload.decidedAt) : ''})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : payload.status === 'REJECTED' ? (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <div>
                                    <span>탑승 및 결제 요청이 거절되었습니다.</span>
                                    {payload.decidedBy && (
                                      <span className="block text-[10px] text-rose-600 font-normal">
                                        처리자: {payload.decidedBy}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  {isParent ? (
                                    <div className="text-center py-2.5 px-3 bg-slate-100 rounded-xl text-xs text-slate-500 font-medium">
                                      담당 차량 지도교사 또는 관리자 승인 대기 중입니다.
                                    </div>
                                  ) : (
                                    <div className="flex gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleDecidePaymentRequest(msg.id, 'APPROVED')}
                                        disabled={isDeciding === msg.id}
                                        className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>결제 수락 (구역/노선 자동배정)</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDecidePaymentRequest(msg.id, 'REJECTED')}
                                        disabled={isDeciding === msg.id}
                                        className="py-2.5 px-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 active:scale-95 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                                      >
                                        거절
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Standard Chat Bubble */
                        isMine ? (
                          <div className="flex justify-end items-end gap-1.5 animate-fade-in">
                            <span className="text-[10px] text-slate-600 select-none pb-1 font-medium">
                              {formatMessageTime(msg.createdAt)}
                            </span>
                            <div className="bg-blue-600 text-white px-3.5 py-2.5 rounded-2xl rounded-tr-xs text-xs font-medium max-w-[70%] break-words shadow-xs">
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 animate-fade-in">
                            <div className="w-9 h-9 rounded-xl bg-white text-slate-700 border border-slate-200 flex items-center justify-center font-black text-xs flex-shrink-0 shadow-2xs">
                              {senderName[0] || '상'}
                            </div>

                            <div className="flex flex-col max-w-[70%]">
                              <div className="flex items-center gap-1.5 mb-1 pl-0.5">
                                <span className="text-xs font-bold text-slate-800">{senderName}</span>
                                {senderRole && getRoleBadge(senderRole)}
                              </div>

                              <div className="flex items-end gap-1.5">
                                <div className="bg-white text-slate-800 px-3.5 py-2.5 rounded-2xl rounded-tl-xs text-xs font-medium break-words shadow-xs border border-white/80">
                                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                </div>
                                <span className="text-[10px] text-slate-600 select-none pb-1 font-medium">
                                  {formatMessageTime(msg.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-end gap-2 shadow-sm">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메세지를 입력하세요. (Enter: 전송, Shift+Enter: 줄바꿈)"
                rows={2}
                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none transition-all"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={isSending || !inputText.trim()}
                className="h-[52px] px-5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 flex-shrink-0"
              >
                <span>전송</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/50">
            <div className="w-16 h-16 rounded-3xl bg-white shadow-md flex items-center justify-center text-slate-300 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-base font-extrabold text-slate-700">선택된 대화방이 없습니다.</h3>
            <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
              좌측 목록에서 대화방을 선택하거나 상단의 [+ 메세지 보내기]를 눌러 새로운 대화를 시작하세요.
            </p>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: 새 대화 상대 선택 (New Chat Role Categorized Modal) */}
      {/* ============================================================ */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">대화 상대 선택</h3>
                <p className="text-xs text-slate-400 mt-0.5">메세지를 보낼 상대를 역할별로 선택하세요 (다수 선택 시 그룹 톡).</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* User Search Bar */}
            <div className="p-3 border-b border-slate-100 bg-white">
              <div className="relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="이름, 역할 또는 이메일 검색..."
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Categorized Users List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingUsers ? (
                <div className="py-12 text-center text-xs text-slate-400 font-semibold">
                  사용자 목록을 불러오는 중...
                </div>
              ) : (
                <>
                  {/* Category 1: 기사 (Drivers) */}
                  {filteredDrivers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-blue-700 bg-blue-50/80 px-2.5 py-1.5 rounded-lg border border-blue-100">
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span>기사 ({filteredDrivers.length}명)</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1 pl-1">
                        {filteredDrivers.map((u) => {
                          const isChecked = selectedUserIds.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${
                                isChecked ? 'bg-blue-50 border-blue-300 shadow-xs' : 'border-slate-100 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectUser(u.id)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                {u.name[0] || '기'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold text-slate-800">{u.name}</span>
                                <span className="text-[11px] text-blue-600 ml-2 font-medium">({u.subText})</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category 2: 교사 (Teachers) */}
                  {filteredTeachers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span>교사 ({filteredTeachers.length}명)</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1 pl-1">
                        {filteredTeachers.map((u) => {
                          const isChecked = selectedUserIds.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${
                                isChecked ? 'bg-emerald-50 border-emerald-300 shadow-xs' : 'border-slate-100 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectUser(u.id)}
                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                              />
                              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                                {u.name[0] || '교'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold text-slate-800">{u.name}</span>
                                <span className="text-[11px] text-emerald-600 ml-2 font-medium">({u.subText})</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category 3: 학부모 (Parents) */}
                  {filteredParents.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-100">
                        <svg className="w-3.5 h-3.5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>학부모 ({filteredParents.length}명)</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1 pl-1">
                        {filteredParents.map((u) => {
                          const isChecked = selectedUserIds.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${
                                isChecked ? 'bg-amber-50 border-amber-300 shadow-xs' : 'border-slate-100 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectUser(u.id)}
                                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                              />
                              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                                {u.name[0] || '학'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold text-slate-800">{u.name}</span>
                                <span className="text-[11px] text-amber-700 ml-2 font-medium">({u.subText})</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category 4: 원장 / 관리자 (Admins) */}
                  {filteredAdmins.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-purple-700 bg-purple-50/80 px-2.5 py-1.5 rounded-lg border border-purple-100">
                        <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>원장 / 관리자 ({filteredAdmins.length}명)</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1 pl-1">
                        {filteredAdmins.map((u) => {
                          const isChecked = selectedUserIds.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${
                                isChecked ? 'bg-purple-50 border-purple-300 shadow-xs' : 'border-slate-100 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectUser(u.id)}
                                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                              />
                              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                                {u.name[0] || '원'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold text-slate-800">{u.name}</span>
                                <span className="text-[11px] text-purple-600 ml-2 font-medium">({u.subText})</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {filteredDrivers.length === 0 &&
                    filteredTeachers.length === 0 &&
                    filteredParents.length === 0 &&
                    filteredAdmins.length === 0 && (
                      <div className="py-10 text-center text-slate-400 text-xs">
                        검색 결과와 일치하는 사용자가 없습니다.
                      </div>
                    )}
                </>
              )}
            </div>

            {/* Modal Bottom: Selection Summary & Group Chat Option */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
              {selectedUserIds.length > 1 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-800">
                    <span>그룹 톡 생성 모드</span>
                    <span className="text-[11px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {selectedUserIds.length}명 선택됨
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="그룹 채팅방 이름 입력 (미입력 시 참여자 이름으로 자동 설정)"
                    value={customGroupName}
                    onChange={(e) => setCustomGroupName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              )}

              {selectedUserIds.length === 1 && (
                <p className="text-xs font-bold text-blue-600">
                  1:1 대화방으로 연결됩니다.
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleStartChat}
                  disabled={isCreatingRoom || selectedUserIds.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isCreatingRoom ? '채팅방 여는 중...' : selectedUserIds.length > 1 ? '그룹 톡 시작' : '대화 시작'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: 신규 탑승 및 결제 신청서 (Payment Request Modal) */}
      {/* ============================================================ */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-indigo-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-indigo-950">신규 탑승 및 결제 신청</h3>
                  <p className="text-[11px] text-indigo-600 font-medium">담당 차량 지도교사에게 탑승 승인 및 배정을 요청합니다.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitPaymentRequest} className="flex-1 overflow-y-auto p-5 space-y-4">
              {isLoadingPaymentContext ? (
                <div className="py-12 text-center text-xs text-slate-400 font-semibold">
                  원생 및 차량 정보를 불러오는 중...
                </div>
              ) : (
                <>
                  {/* 1. 원생(학생) 선택 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1">
                        <span>탑승 원생(학생)</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setPaymentForm((prev) => ({ ...prev, studentSelectMode: 'DROPDOWN' }))}
                          className={`font-bold pb-0.5 border-b-2 transition-colors ${
                            paymentForm.studentSelectMode === 'DROPDOWN'
                              ? 'border-indigo-600 text-indigo-600'
                              : 'border-transparent text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          등록된 원생 선택
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setPaymentForm((prev) => ({ ...prev, studentSelectMode: 'CUSTOM', selectedStudentId: '' }))}
                          className={`font-bold pb-0.5 border-b-2 transition-colors ${
                            paymentForm.studentSelectMode === 'CUSTOM'
                              ? 'border-indigo-600 text-indigo-600'
                              : 'border-transparent text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          신규 원생 직접 입력
                        </button>
                      </div>
                    </div>

                    {paymentForm.studentSelectMode === 'DROPDOWN' ? (
                      <select
                        value={paymentForm.selectedStudentId}
                        onChange={(e) => handleStudentSelect(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">-- 원생을 선택하세요 --</option>
                        {(paymentContext.students || []).map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} ({st.assignedBusNumber ? `${st.assignedBusNumber}` : '미배정'}) - {st.boardingLocation || st.address || '주소 미등록'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="신규 원생 이름 입력 (예: 김민수)"
                        value={paymentForm.customStudentName}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, customStudentName: e.target.value }))}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                      />
                    )}
                  </div>

                  {/* 2. 담당 차량(호차) 및 지도교사 선택 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <span>배정 희망 차량 (호차)</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentForm.selectedVehicleId}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, selectedVehicleId: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- 차량(호차)을 선택하세요 --</option>
                      {(paymentContext.vehicles || []).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.busNumber} (담당 지도교사: {v.teacherName} / 기사: {v.driverName})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. 탑승 희망 위치 (기존 탑승지 or 직접 입력) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1">
                        <span>탑승 희망 위치</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setPaymentForm((prev) => ({ ...prev, locationSelectMode: 'PICKUP_POINT' }))}
                          className={`font-bold pb-0.5 border-b-2 transition-colors ${
                            paymentForm.locationSelectMode === 'PICKUP_POINT'
                              ? 'border-indigo-600 text-indigo-600'
                              : 'border-transparent text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          기존 탑승지 목록
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setPaymentForm((prev) => ({ ...prev, locationSelectMode: 'CUSTOM' }))}
                          className={`font-bold pb-0.5 border-b-2 transition-colors ${
                            paymentForm.locationSelectMode === 'CUSTOM'
                              ? 'border-indigo-600 text-indigo-600'
                              : 'border-transparent text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          직접 위치/주소 입력
                        </button>
                      </div>
                    </div>

                    {paymentForm.locationSelectMode === 'PICKUP_POINT' && (paymentContext.pickupPoints || []).length > 0 ? (
                      <select
                        value={paymentForm.selectedPickupPointId}
                        onChange={(e) => handlePickupPointSelect(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">-- 등록된 탑승지를 선택하세요 --</option>
                        {(paymentContext.pickupPoints || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="탑승 위치명 입력 (예: 경동대 메트로폴 정문)"
                        value={paymentForm.boardingLocation}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, boardingLocation: e.target.value }))}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                      />
                    )}

                    <input
                      type="text"
                      placeholder="상세 주소 (선택 입력)"
                      value={paymentForm.address}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, address: e.target.value }))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* 4. 탑승 희망 날짜 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <span>탑승 희망 일자</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentForm.requestDate}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, requestDate: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* 5. 요청 메세지 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800">요청 메시지</label>
                    <textarea
                      rows={3}
                      value={paymentForm.note}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
                      placeholder="지도교사에게 전달할 메시지를 입력하세요."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-medium leading-relaxed"
                    />
                  </div>
                </>
              )}

              {/* Modal Buttons */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2 -mx-5 -mb-5 mt-4">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment || isLoadingPaymentContext}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSubmittingPayment ? '신청서 전송 중...' : '결제 신청서 보내기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: 참여자 목록 (Active Room Participants Popover) */}
      {/* ============================================================ */}
      {showParticipantsModal && activeRoom && (
        <div className="fixed inset-0 z-[3000] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col max-h-[70vh] animate-scale-up">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h4 className="text-sm font-extrabold text-slate-800">
                대화 참여자 ({(activeRoom.members || []).length}명)
              </h4>
              <button
                type="button"
                onClick={() => setShowParticipantsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 divide-y divide-slate-100 overflow-y-auto max-h-96">
              {(activeRoom.members || []).map((m) => {
                const u = m.user;
                if (!u) return null;
                const isMe = u.email === myUser.email;
                return (
                  <div key={m.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                        {u.name?.[0] || '사'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 truncate">{u.name}</span>
                          {isMe && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded font-bold">나</span>}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate">{u.email}</span>
                      </div>
                    </div>
                    {getRoleBadge(u.role)}
                  </div>
                );
              })}
            </div>
            <div className="p-3 border-t border-slate-100 bg-slate-50 text-right">
              <button
                type="button"
                onClick={() => setShowParticipantsModal(false)}
                className="px-4 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
