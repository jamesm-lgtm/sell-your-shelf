import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import BookScanner from './components/BookScanner';

export default function App() {
  return (
    <View style={styles.container}>
      <BookScanner />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
