import * as React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement>

export default function Button(props: Props) {
  const { className = '', ...rest } = props
  return (
    <button
      {...rest}
      className={
        'px-4 py-2 rounded-xl border hover:shadow transition disabled:opacity-50 ' + className
      }
    />
  )
}
