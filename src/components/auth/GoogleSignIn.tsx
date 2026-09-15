import React from 'react';
import { SocialSignIn } from './SocialSignIn';

export function GoogleSignIn(props: React.ComponentProps<typeof SocialSignIn>) {
  return <SocialSignIn {...props} provider="Google" />;
}
