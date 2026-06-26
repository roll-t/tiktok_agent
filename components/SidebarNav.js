'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SidebarNav() {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/',
      label: 'Dashboard',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9"></rect>
          <rect x="14" y="3" width="7" height="5"></rect>
          <rect x="14" y="12" width="7" height="9"></rect>
          <rect x="3" y="16" width="7" height="5"></rect>
        </svg>
      )
    },
    {
      href: '/accounts',
      label: 'Quản Lý Kênh',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      )
    },
    {
      href: '/download',
      label: 'Tải & Reup Video',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      )
    },
    {
      href: '/posts',
      label: 'Đăng Clip / Lên Lịch',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      )
    }
  ];

  return (
    <aside className="sidebar-nav">
      <div className="sidebar-header">
        <h2 className="gradient-text" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
          AutoPoster
        </h2>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>v1.0.0 Alpha</span>
      </div>
      
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '32px' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={(e) => {
                if (typeof window !== 'undefined' && window.isAppBusy) {
                  const confirmLeave = window.confirm('Hệ thống đang thực hiện tác vụ tải lên hoặc xử lý video. Nếu bạn rời trang, tiến trình này có thể bị hủy bỏ. Bạn vẫn muốn tiếp tục rời đi?');
                  if (!confirmLeave) {
                    e.preventDefault();
                  }
                }
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#00f2fe' }}>
          <span style={{ width: '6px', height: '6px', backgroundColor: '#00f2fe', borderRadius: '50%', display: 'inline-block' }}></span>
          Hệ thống đang chạy
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Local Dev Server</span>
      </div>
    </aside>
  );
}
