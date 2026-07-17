import kap from './kap';

let nextActionId = 0;
const actions = new Map<string, () => void>();

type SerializedMenuItem = {
  actionId?: string;
  checked?: boolean;
  enabled?: boolean;
  iconDataUrl?: string;
  label?: string;
  separator?: boolean;
  subMenu?: SerializedMenuItem[];
  submenu?: SerializedMenuItem[];
  type?: string;
  value?: unknown;
};

kap.ipc.on('kap:menu:action', (actionId: string) => {
  actions.get(actionId)?.();
});

export const serializeMenuTemplate = (template: any[]): SerializedMenuItem[] => template.map(item => {
  if (item.type === 'separator' || item.separator) {
    return {type: 'separator'};
  }

  const {click, icon, ...rest} = item;
  const serialized: SerializedMenuItem = {
    ...rest,
    iconDataUrl: icon,
    submenu: item.submenu ? serializeMenuTemplate(item.submenu) : undefined,
    subMenu: item.subMenu ? serializeMenuTemplate(item.subMenu) : undefined
  };

  if (typeof click === 'function') {
    const actionId = `menu-action-${nextActionId++}`;
    actions.set(actionId, click);
    serialized.actionId = actionId;
  }

  return serialized;
});

export const popupMenu = (template: any[], position?: {x?: number; y?: number}) => {
  return kap.menu.popup(serializeMenuTemplate(template), position);
};
