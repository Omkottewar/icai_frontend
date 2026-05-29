import { useRoute } from '../../hooks/useRoute';

export default function Link({ to, children, className = '', onClick, activeClassName }) {
  const route = useRoute();
  const active = route.path === to || (to !== '/' && route.path.startsWith(to));
  return (
    <a
      href={'#' + to}
      className={className + (active && activeClassName ? ' ' + activeClassName : '')}
      onClick={(e) => { onClick && onClick(e); }}
    >
      {children}
    </a>
  );
}
