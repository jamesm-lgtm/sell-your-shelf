import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';

interface Book {
  title: string;
  author: string;
  confidence: string;
}

export default function BookScanner() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Extract frames from recorded video
  const extractFrames = async (uri: string): Promise<string[]> => {
    const frames: string[] = [];
    const frameCount = 20;
    const estimatedDuration = 30;
    const interval = estimatedDuration / frameCount;
    
    for (let i = 0; i < frameCount; i++) {
      const timeMs = i * interval * 1000;
      
      try {
        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(uri, {
          time: timeMs,
          quality: 0.9,
        });
        
        const response = await fetch(thumbnailUri);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        frames.push(base64.split(',')[1]);
      } catch (e) {
        console.warn(`Failed to extract frame ${i}:`, e);
      }
    }
    
    return frames;
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Launch camera to record video
  const recordVideo = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to scan books');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (!result.canceled && result.assets[0]) {
        processVideo(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Camera launch failed:', err);
      setError('Failed to open camera');
    }
  };

  // Process the recorded video
  const processVideo = async (uri: string) => {
    setIsProcessing(true);
    setError('');
    setBooks([]);

    const startTime = performance.now();

    try {
      // Stage 1: Extract frames
      setStage('Extracting frames from video...');
      const frameStart = performance.now();
      const frames = await extractFrames(uri);
      const frameTime = ((performance.now() - frameStart) / 1000).toFixed(1);
      console.log(`✅ Extracted ${frames.length} frames in ${frameTime}s`);

      // Stage 2: OCR with Vision API
      setStage('Reading text with Google Vision API...');
      const ocrStart = performance.now();
      
      const ocrResponse = await fetch('https://sell-your-shelf-app.vercel.app/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames }),
      });

      if (!ocrResponse.ok) {
        throw new Error('OCR failed');
      }

      const ocrData = await ocrResponse.json();
      const ocrTime = ((performance.now() - ocrStart) / 1000).toFixed(1);
      console.log(`✅ OCR complete in ${ocrTime}s`);

      // Stage 3: Analyze with Claude
      setStage('Identifying books with Claude AI...');
      const claudeStart = performance.now();
      const analysisResponse = await fetch('https://sell-your-shelf-app.vercel.app/api/analyze-books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocrFrames: ocrData.frames }),
      });

      if (!analysisResponse.ok) {
        throw new Error('Book analysis failed');
      }

      const analysisData = await analysisResponse.json();
      const claudeTime = ((performance.now() - claudeStart) / 1000).toFixed(1);
      console.log(`✅ Claude analysis complete in ${claudeTime}s`);

      setBooks(analysisData.books);
      setStage('');

      const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`🎉 TOTAL TIME: ${totalTime}s`);
      console.log(`📚 Books identified: ${analysisData.books.length}`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      console.error(err);
      setStage('');
    } finally {
      setIsProcessing(false);
    }
  };

  // Save books to database
  const handleSaveBooks = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch('https://sell-your-shelf-app.vercel.app/api/save-books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books }),
      });

      if (!response.ok) {
        throw new Error('Failed to save books');
      }

      const data = await response.json();
      console.log(`✅ Saved ${data.saved_count} books`);
      
      setSaveSuccess(true);
      Alert.alert('Success', `Saved ${books.length} books to your listings!`);
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save books to database');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to scan again
  const resetScanner = () => {
    setBooks([]);
    setError('');
    setSaveSuccess(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Sell Your Shelf</Text>
        <Text style={styles.subtitle}>Scan your bookshelf to list books for sale</Text>

        {!isProcessing && books.length === 0 && (
          <View style={styles.scanSection}>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={recordVideo}
            >
              <Text style={styles.scanButtonText}>📹 Record Bookshelf</Text>
            </TouchableOpacity>
            <Text style={styles.instructionText}>
              Tip: Pan slowly across your shelf for 10-15 seconds
            </Text>
          </View>
        )}

        {isProcessing && (
          <View style={styles.processingBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.stageText}>{stage}</Text>
            <Text style={styles.subText}>This may take 30-60 seconds...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {books.length > 0 && (
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                Identified Books ({books.length})
              </Text>
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.disabledButton]}
                onPress={handleSaveBooks}
                disabled={isSaving}
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Saving...' : 'Save All'}
                </Text>
              </TouchableOpacity>
            </View>

            {saveSuccess && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>
                  ✅ Saved {books.length} books to your listings!
                </Text>
              </View>
            )}

            {books.map((book, idx) => (
              <View
                key={idx}
                style={[
                  styles.bookCard,
                  book.confidence === 'high' && styles.highConfidence,
                  book.confidence === 'medium' && styles.mediumConfidence,
                ]}
              >
                <Text style={styles.bookTitle}>{book.title}</Text>
                <Text style={styles.bookAuthor}>by {book.author}</Text>
                <Text style={styles.bookConfidence}>
                  Confidence: {book.confidence}
                </Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetScanner}
            >
              <Text style={styles.resetButtonText}>Scan Another Shelf</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
  },
  scanSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  scanButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  instructionText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  processingBox: {
    backgroundColor: '#eff6ff',
    padding: 24,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  stageText: {
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 16,
    fontSize: 16,
  },
  subText: {
    color: '#3b82f6',
    fontSize: 14,
    marginTop: 8,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
  },
  resultsContainer: {
    marginTop: 24,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  successText: {
    color: '#166534',
    fontWeight: '600',
  },
  bookCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    backgroundColor: '#f9fafb',
    borderLeftColor: '#9ca3af',
  },
  highConfidence: {
    backgroundColor: '#f0fdf4',
    borderLeftColor: '#22c55e',
  },
  mediumConfidence: {
    backgroundColor: '#fef9c3',
    borderLeftColor: '#eab308',
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 4,
  },
  bookConfidence: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  resetButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});