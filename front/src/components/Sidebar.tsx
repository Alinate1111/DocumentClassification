import { useState } from 'react';
import {
  Menu,
  Home,
  FileText,
  FolderTree,
  BarChart3,
  Settings,
  Users,
  Bell,
  HelpCircle,
  Shield
} from 'lucide-react';

interface SidebarProps {
  currentPage: 'home' | 'management' | 'history' | 'documents' | 'statistics' | 'profile';
  onPageChange: (page: 'home' | 'management' | 'history' | 'documents' | 'statistics' | 'profile') => void;
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`${isCollapsed ? 'w-16' : 'w-64'} text-white flex flex-col transition-all duration-300`}
      style={{ background: 'linear-gradient(to bottom, #1a1a1a, #0a0a0a)' }}
    >
      {/* Logo Section */}
      <div className="p-4 flex items-center gap-2" style={{ borderBottom: '1px solid #333' }}>
        <Menu
          className="w-5 h-5 cursor-pointer hover:text-gray-300 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        />
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-90">Dclassification</span>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-2">
        <SidebarItem
          icon={<Home />}
          label="홈"
          active={currentPage === 'home'}
          onClick={() => onPageChange('home')}
          isCollapsed={isCollapsed}
        />
        <SidebarItem
          icon={<FileText />}
          label="문서"
          active={currentPage === 'documents'}
          onClick={() => onPageChange('documents')}
          isCollapsed={isCollapsed}
        />
        <SidebarItem
          icon={<FolderTree />}
          label="카테고리 분류"
          active={currentPage === 'management' || currentPage === 'history'}
          subItems={[
            { label: '관리', active: currentPage === 'management', onClick: () => onPageChange('management') },
            { label: '변경이력', active: currentPage === 'history', onClick: () => onPageChange('history') }
          ]}
          isCollapsed={isCollapsed}
        />
        <SidebarItem
          icon={<BarChart3 />}
          label="통계"
          active={currentPage === 'statistics'}
          onClick={() => onPageChange('statistics')}
          isCollapsed={isCollapsed}
        />
        <SidebarItem
          icon={<Users />}
          label="사용자"
          active={currentPage === 'profile'}  
          onClick={() => onPageChange('profile')} 
          isCollapsed={isCollapsed}
        />
        <SidebarItem icon={<Bell />} label="알림" isCollapsed={isCollapsed} />
        <SidebarItem icon={<Settings />} label="설정" isCollapsed={isCollapsed} />
        <SidebarItem icon={<HelpCircle />} label="도움말" isCollapsed={isCollapsed} />
        <SidebarItem icon={<Shield />} label="보안" isCollapsed={isCollapsed} />
      </nav>
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  subItems?: { label: string; active?: boolean; onClick?: () => void }[];
  isCollapsed?: boolean;
}

function SidebarItem({ icon, label, active, onClick, subItems, isCollapsed }: SidebarItemProps) {
  return (
    <div>
      <div
        onClick={onClick}
        className="px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors"
        style={{
          backgroundColor: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title={isCollapsed ? label : ''}
      >
        <div className="w-5 h-5 flex-shrink-0">{icon}</div>
        {!isCollapsed && <span className="text-sm">{label}</span>}
      </div>
      {subItems && !isCollapsed && (
        <div className="ml-8">
          {subItems.map((item, index) => (
            <div
              key={index}
              onClick={item.onClick}
              className="px-4 py-2 text-sm cursor-pointer transition-colors"
              style={{
                backgroundColor: item.active ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                borderLeft: item.active ? '2px solid white' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!item.active) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                if (!item.active) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
