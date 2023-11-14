import styles from "./styles.module.css";

interface TextProps {
  children: React.ReactNode;
  className?: string;
}

export const Text: React.FC<TextProps> = ({ children, className }) => {
  return <p className={`${styles.text} ${className}`}>{children}</p>;
};
