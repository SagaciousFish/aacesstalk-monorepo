import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect root to the Sign In page
  return <Redirect href="/signin" />;
}
