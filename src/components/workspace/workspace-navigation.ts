export interface NavigationItem {
  id: 'home' | 'table' | 'journal' | 'companion' | 'settings';
  label: string;
  iconName: 'Home' | 'Users' | 'BookOpen' | 'MessageSquare' | 'User';
  href: string;
}

export const WORKSPACE_NAVIGATION_CONFIG: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    iconName: 'Home',
    href: '/dashboard'
  },
  {
    id: 'table',
    label: 'Munch Table',
    iconName: 'Users',
    href: '/table'
  },
  {
    id: 'journal',
    label: 'Journal',
    iconName: 'BookOpen',
    href: '/history'
  },
  {
    id: 'companion',
    label: 'Conversations',
    iconName: 'MessageSquare',
    href: '/our-conversations'
  },
  {
    id: 'settings',
    label: 'Profile',
    iconName: 'User',
    href: '/profile'
  }
];
