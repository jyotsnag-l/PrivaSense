"""
Comprehensive demo script to test all ML models and show what they extract.
This script demonstrates the full pipeline from transcription to PDI scoring.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from pipeline.transcriber import synthetic_transcription
from pipeline.features import extract_all_features
from pipeline.pdi import compute_pdi, risk_label, explain_with_shap, build_feature_table, PDI_WEIGHTS, COGNITIVE_DOMAIN_MAP
from pipeline.baseline import update_baseline, get_baseline, load_baselines
import json


def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_subsection(title):
    """Print a formatted subsection header."""
    print(f"\n--- {title} ---")


def demo_transcriber():
    """Demo the transcription model."""
    print_section("1. TRANSCRIBER MODEL (Whisper-based)")
    
    print_subsection("Synthetic Transcription for Demo")
    
    # Generate synthetic transcription
    transcription = synthetic_transcription(duration_secs=30.0)
    
    print(f"\n📝 Full Transcript:")
    print(f"   {transcription['text']}")
    
    print(f"\n📊 Segments ({len(transcription['segments'])} segments):")
    print(f"   {'ID':<4} {'Start':<8} {'End':<8} {'Duration':<8} {'Text'}")
    print(f"   {'-'*4} {'-'*8} {'-'*8} {'-'*8} {'-'*40}")
    
    for seg in transcription['segments']:
        duration = seg['end'] - seg['start']
        print(f"   {seg['id']:<4} {seg['start']:<8.3f} {seg['end']:<8.3f} {duration:<8.3f} {seg['text'][:40]}...")
    
    return transcription


def demo_feature_extraction(transcription):
    """Demo the feature extraction model."""
    print_section("2. FEATURE EXTRACTION MODEL (6 Cognitive Features)")
    
    print_subsection("Extracting Features from Transcription")
    
    # Extract all features using demo mode (no real audio needed)
    features = extract_all_features("__demo__", transcription)
    
    print(f"\n🧠 Extracted Cognitive Features:")
    print(f"   {'Feature':<25} {'Value':<12} {'Domain'}")
    print(f"   {'-'*25} {'-'*12} {'-'*30}")
    
    for feature_name, value in features.items():
        domain = COGNITIVE_DOMAIN_MAP.get(feature_name, "Unknown")
        print(f"   {feature_name:<25} {value:<12.4f} {domain}")
    
    print(f"\n💡 Feature Explanations:")
    print(f"   • pause_rate: Frequency of pauses >0.3s per second")
    print(f"   • mean_pause_duration: Average length of pauses in seconds")
    print(f"   • speech_rate_wpm: Words per minute (speaking speed)")
    print(f"   • filler_rate: Ratio of filler words (um, uh, you know, etc.)")
    print(f"   • lexical_diversity: Vocabulary variety (0-1, higher = more diverse)")
    print(f"   • pitch_variability: Voice pitch variation (requires real audio)")
    
    return features


def demo_baseline_management(features, user_id="demo_user"):
    """Demo the baseline management system."""
    print_section("3. BASELINE MANAGEMENT (EMA-based)")
    
    print_subsection("Baseline Storage & Updates")
    
    # Load existing baselines
    baselines = load_baselines()
    
    # Show current baseline if exists
    current_baseline = get_baseline(user_id, baselines)
    if current_baseline:
        print(f"\n📈 Current Baseline for user '{user_id}':")
        for feature, value in current_baseline.items():
            print(f"   {feature}: {value:.4f}")
    else:
        print(f"\n🆕 No existing baseline for user '{user_id}' - will create new one")
    
    # Update baseline with new features
    print(f"\n🔄 Updating baseline with new session data...")
    baselines = update_baseline(user_id, features, baselines)
    
    # Show updated baseline
    updated_baseline = get_baseline(user_id, baselines)
    print(f"\n✅ Updated Baseline:")
    for feature, value in updated_baseline.items():
        old_value = current_baseline.get(feature, value)
        change = value - old_value
        direction = "↑" if change > 0 else "↓" if change < 0 else "="
        print(f"   {feature}: {value:.4f} ({direction} {abs(change):.4f})")
    
    return updated_baseline


def demo_pdi_scoring(features, baseline):
    """Demo the PDI scoring model."""
    print_section("4. PDI SCORING MODEL (Privacy-first Decline Indicator)")
    
    print_subsection("Computing PDI Score & Risk Assessment")
    
    # Compute PDI
    pdi_score, contributions = compute_pdi(features, baseline)
    risk = risk_label(pdi_score)
    
    print(f"\n🎯 PDI Score: {pdi_score:.4f}")
    print(f"⚠️  Risk Level: {risk}")
    
    # Show risk thresholds
    print(f"\n📊 Risk Thresholds:")
    print(f"   LOW:    PDI < 0.25")
    print(f"   MEDIUM: 0.25 ≤ PDI < 0.50")
    print(f"   HIGH:   PDI ≥ 0.50")
    
    print_subsection("Feature Contributions to PDI")
    print(f"\n   {'Feature':<25} {'Contribution':<15} {'Impact'}")
    print(f"   {'-'*25} {'-'*15} {'-'*20}")
    
    for feature, contribution in contributions.items():
        impact = "⚠️ Worse" if contribution > 0 else "✅ Better" if contribution < 0 else "➡️ Neutral"
        print(f"   {feature:<25} {contribution:+.4f}          {impact}")
    
    return pdi_score, contributions


def demo_shap_explanation(features, baseline):
    """Demo SHAP-like explanations."""
    print_section("5. SHAP EXPLANATIONS (Feature Attribution)")
    
    print_subsection("Computing SHAP Values")
    
    # Compute SHAP values
    shap_values = explain_with_shap(features, baseline)
    
    print(f"\n🔍 SHAP Attribution Values:")
    print(f"   (Shows relative importance of each feature to the PDI score)")
    print(f"\n   {'Feature':<25} {'SHAP Value':<12} {'Importance'}")
    print(f"   {'-'*25} {'-'*12} {'-'*20}")
    
    # Sort by absolute value to show most important first
    sorted_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)
    
    for feature, shap_value in sorted_shap:
        importance = "🔴 High" if abs(shap_value) > 0.3 else "🟡 Medium" if abs(shap_value) > 0.15 else "🟢 Low"
        direction = "↑" if shap_value > 0 else "↓" if shap_value < 0 else "="
        print(f"   {feature:<25} {shap_value:+.4f}         {importance} {direction}")
    
    return shap_values


def demo_feature_table(features, baseline, shap_values):
    """Demo the feature table builder."""
    print_section("6. FEATURE TABLE (API Response Format)")
    
    print_subsection("Building Feature Table for API Response")
    
    # Build feature table
    table = build_feature_table(features, baseline, shap_values)
    
    print(f"\n📋 Feature Table ({len(table)} features):")
    print(f"   {'Feature':<25} {'Today':<8} {'Baseline':<10} {'SHAP':<8} {'Direction':<10} {'Domain'}")
    print(f"   {'-'*25} {'-'*8} {'-'*10} {'-'*8} {'-'*10} {'-'*25}")
    
    for row in table:
        direction_arrow = "↑" if row.direction == "up" else "↓"
        print(f"   {row.feature:<25} {row.today:<8.4f} {row.baseline:<10.4f} {row.shap:<+8.4f} {direction_arrow:<10} {row.domain}")
    
    return table


def main():
    """Main demo function."""
    print("\n🧠 PRIVASENSE ML MODELS DEMO")
    print("Privacy-first cognitive monitoring system")
    print("=" * 60)
    
    try:
        # Step 1: Transcription
        transcription = demo_transcriber()
        
        # Step 2: Feature Extraction
        features = demo_feature_extraction(transcription)
        
        # Step 3: Baseline Management
        baseline = demo_baseline_management(features)
        
        # Step 4: PDI Scoring
        pdi_score, contributions = demo_pdi_scoring(features, baseline)
        
        # Step 5: SHAP Explanations
        shap_values = demo_shap_explanation(features, baseline)
        
        # Step 6: Feature Table
        table = demo_feature_table(features, baseline, shap_values)
        
        # Summary
        print_section("SUMMARY")
        print(f"\n✅ All ML models tested successfully!")
        print(f"\n📊 Pipeline Summary:")
        print(f"   1. Transcription: {len(transcription['segments'])} segments extracted")
        print(f"   2. Features: {len(features)} cognitive features computed")
        print(f"   3. Baseline: Updated with EMA (α=0.25)")
        print(f"   4. PDI Score: {pdi_score:.4f} ({risk_label(pdi_score)} risk)")
        print(f"   5. SHAP: Feature attribution computed")
        print(f"   6. Table: {len(table)} feature rows generated")
        
        print(f"\n🎯 Key Insights:")
        print(f"   • System extracts speech patterns without storing raw audio")
        print(f"   • Baselines adapt over time using exponential moving average")
        print(f"   • PDI provides interpretable cognitive decline indicators")
        print(f"   • SHAP values explain which features drive the risk score")
        
    except Exception as e:
        print(f"\n❌ Error during demo: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())