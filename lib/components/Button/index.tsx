import { ButtonHTMLAttributes } from "react";
import styles from "./styles.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  className?: string;
};

export function Button(props: ButtonProps) {
  const { className, ...restProps } = props;
  return <button className={`${className} ${styles.button}`} {...restProps} />;
}
