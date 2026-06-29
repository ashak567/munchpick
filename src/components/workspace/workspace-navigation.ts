export interface NavigationItem {
  id: 'home' | 'journal' | 'companion' | 'settings';
  label: string;
  iconName: 'Home' | 'BookOpen' | 'Heart' | 'Settings';
}

export const WORKSPACE_NAVIGATION_CONFIG: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    iconName: 'Home'
  },
  {
    id: 'journal',
    label: 'Journal',
    iconName: 'BookOpen'
  },
  {
    id: 'companion',
    label: 'Companion',
    iconName: 'Heart'
  },
  {
    id: 'settings',
    label: 'Settings',
    iconName: 'Settings'
  }
];
