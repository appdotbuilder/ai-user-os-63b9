import { db } from '../db';
import { notesTable } from '../db/schema';
import { type FinaliseMeetingInput } from '../schema';
import { eq } from 'drizzle-orm';

export const finaliseMeeting = async (input: FinaliseMeetingInput): Promise<{ summary_text: string; entities: Record<string, any> }> => {
  try {
    // Fetch the note to ensure it exists and get transcript data
    const notes = await db.select()
      .from(notesTable)
      .where(eq(notesTable.id, input.note_id))
      .execute();

    if (notes.length === 0) {
      throw new Error(`Note with id ${input.note_id} not found`);
    }

    const note = notes[0];

    // Validate that this is a meeting note with transcript data
    if (note.source !== 'meeting') {
      throw new Error('Note must be from a meeting source to finalize');
    }

    if (!note.transcript_text || note.transcript_text.trim() === '') {
      throw new Error('Note must have transcript text to finalize');
    }

    // Process the transcript text to generate summary and extract entities
    const processedData = await processTranscript(note.transcript_text);

    // Update the note with the processed data
    await db.update(notesTable)
      .set({
        summary_text: processedData.summary_text,
        entities: processedData.entities,
        updated_at: new Date()
      })
      .where(eq(notesTable.id, input.note_id))
      .execute();

    return processedData;
  } catch (error) {
    console.error('Meeting finalization failed:', error);
    throw error;
  }
};

// Mock AI processing function - in real implementation this would call an LLM
async function processTranscript(transcript: string): Promise<{ summary_text: string; entities: Record<string, any> }> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Extract basic information from transcript for demonstration
  const words = transcript.toLowerCase().split(/\s+/);
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Mock entity extraction based on common patterns
  const people = extractPeople(transcript);
  const decisions = extractDecisions(transcript);
  const risks = extractRisks(transcript);
  const dates = extractDates(transcript);

  // Generate a basic summary
  const summary = generateSummary(sentences, people, decisions);

  return {
    summary_text: summary,
    entities: {
      decisions,
      risks,
      people,
      dates
    }
  };
}

function extractPeople(transcript: string): string[] {
  // Simple pattern matching for names (capitalized words that might be names)
  const namePattern = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g;
  const matches = transcript.match(namePattern) || [];
  
  // Filter out common false positives and deduplicate
  const commonWords = ['The', 'This', 'That', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const people = [...new Set(matches.filter(name => !commonWords.includes(name)))];
  
  return people.slice(0, 10); // Limit to reasonable number
}

function extractDecisions(transcript: string): Array<{ decision: string; context: string }> {
  const decisionKeywords = ['decided', 'agreed', 'resolved', 'concluded', 'determined', 'will do', 'action item'];
  const decisions: Array<{ decision: string; context: string }> = [];
  
  const sentences = transcript.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    for (const keyword of decisionKeywords) {
      if (lowerSentence.includes(keyword)) {
        decisions.push({
          decision: sentence.trim(),
          context: keyword
        });
        break;
      }
    }
  }
  
  return decisions.slice(0, 5); // Limit results
}

function extractRisks(transcript: string): Array<{ risk: string; severity: string }> {
  const riskKeywords = ['risk', 'concern', 'issue', 'problem', 'challenge', 'blocker', 'obstacle'];
  const risks: Array<{ risk: string; severity: string }> = [];
  
  const sentences = transcript.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    for (const keyword of riskKeywords) {
      if (lowerSentence.includes(keyword)) {
        // Simple severity assessment based on keywords
        let severity = 'medium';
        if (lowerSentence.includes('critical') || lowerSentence.includes('urgent')) {
          severity = 'high';
        } else if (lowerSentence.includes('minor') || lowerSentence.includes('small')) {
          severity = 'low';
        }
        
        risks.push({
          risk: sentence.trim(),
          severity
        });
        break;
      }
    }
  }
  
  return risks.slice(0, 5); // Limit results
}

function extractDates(transcript: string): Array<{ date: string; context: string }> {
  // Simple date pattern matching
  const datePatterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // MM/DD/YYYY
    /\b\d{1,2}-\d{1,2}-\d{4}\b/g,   // MM-DD-YYYY
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/g, // Month DD, YYYY
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/g // Short month
  ];
  
  const dates: Array<{ date: string; context: string }> = [];
  const sentences = transcript.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    for (const pattern of datePatterns) {
      const matches = sentence.match(pattern);
      if (matches) {
        for (const match of matches) {
          dates.push({
            date: match,
            context: sentence.trim()
          });
        }
      }
    }
  }
  
  return dates.slice(0, 5); // Limit results
}

function generateSummary(sentences: string[], people: string[], decisions: Array<{ decision: string; context: string }>): string {
  const totalSentences = sentences.length;
  const participantCount = people.length;
  const decisionCount = decisions.length;
  
  let summary = `Meeting summary: This meeting involved ${participantCount > 0 ? participantCount + ' participants' : 'multiple participants'}`;
  
  if (people.length > 0) {
    summary += ` including ${people.slice(0, 3).join(', ')}`;
    if (people.length > 3) {
      summary += ` and ${people.length - 3} others`;
    }
  }
  
  summary += `. `;
  
  if (decisionCount > 0) {
    summary += `${decisionCount} key decision${decisionCount > 1 ? 's were' : ' was'} made during the discussion. `;
  }
  
  // Add a few key sentences from the middle of the transcript
  if (totalSentences > 2) {
    const midPoint = Math.floor(totalSentences / 2);
    const keySentence = sentences[midPoint]?.trim();
    if (keySentence && keySentence.length > 20) {
      summary += `Key discussion point: ${keySentence}. `;
    }
  }
  
  summary += `The meeting covered various topics and lasted for approximately ${Math.ceil(totalSentences / 10)} minutes of discussion.`;
  
  return summary;
}